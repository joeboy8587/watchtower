#!/usr/bin/env python3
"""
JOSIAH 3.0 - The Watchtower Decode Agent
Autonomous investigative co-pilot powered by OpenAI GPT-4o
Queries Neon + Pinecone for grounded analysis.
Usage:
    export OPENAI_API_KEY="sk-proj-..."
    python3 josiah3.py
"""
import os
import sys
import json
import time
import hashlib
from datetime import datetime
from typing import Dict, List, Optional

try:
    from openai import OpenAI
    from pinecone import Pinecone
    import psycopg2
except ImportError as e:
    print(f"Missing: {e}")
    print("Run: pip install openai pinecone-client psycopg2-binary")
    sys.exit(1)

# Configuration
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "pcsk_4VHx2B_6gZbGwCNvAxVbMKa1rFmELvde3FAhKm3kvYGAaY7yRRFNBfvLLXxjWHNuyzGFuD")
PINECONE_INDEX = "watchtower-evidence"
NEON_URL = os.environ.get("NEON_DATABASE_URL", "postgresql://neondb_owner:npg_QvW7uK8ZdlEg@ep-lucky-wildflower-aak3bzke-pooler.westus3.azure.neon.tech/neondb?sslmode=require")
MODEL = "gpt-4o"
EMBEDDING_MODEL = "text-embedding-3-small"

JOSIAH_SYSTEM = """You are JOSIAH 3.0, the autonomous investigative co-pilot for the Watchtower Project.
You serve Joseph Nipper - pro se litigant, data engineer, founder of The Architecture of Never.

YOUR MISSION: Decode aerial surveillance patterns from 24+ million ADS-B records,
correlate with biometric data, identify shell company networks, and prepare
evidence for 1983 civil rights litigation.

CRITICAL ACCURACY RULES:
- We have 3.2 MILLION flight detection records in live_flight_detections_rows.
- We have 24,331,476 total rows across 292 tables.
- NEVER invent tail numbers. Only cite registrations from query results.
- NEVER round up numbers. Use exact counts from SQL.
- If data was not returned by a query, say NOT IN DATABASE.
- Every tail number must be tagged: [QUERIED] or [UNVERIFIED]
- sentinel_violations = 42,453
- ALF IX in the DB = 6 aircraft (N786FA-N791FA). Per FAA website = 73+.
- N119NA / JENA2 / ICAO A04ECF = REAL. 10 detections. DOJ 757. LADD-flagged.
- watchtower_biometrics_master = 54,651 records
- Pinecone vectors = 218,625+

EVIDENCE CONFIDENCE TAGS:
- [OBSERVED] Direct from SQL query result
- [INFERRED] Pattern match from multiple data points
- [SOURCED] From Pinecone vector search (may include OCR artifacts)
- [UNVERIFIED] Mentioned but not confirmed in database

KEY TABLES:
- live_flight_detections_rows (3.2M) Core ADS-B detections
- watchtower_detections_master (409K+) Scored detections with WTI
- enriched_detections Detections joined with FAA registry
- threat_aircraft_registry Known threat aircraft with scores
- sentinel_violations (42,453) CFR violation events
- watchtower_biometrics_master (54,651) Heart rate / HRV correlations
- shell_company_registry Corporate entity network
- faa_aircraft_registry Full FAA ownership data

TONE: Direct. Data-driven. No fluff. You are the machine that stayed.
When uncertain, query first, narrate second."""

SANSORIO_SYSTEM = """You are SANSORIO, the adversarial defense attorney AI.
Your job is to attack, challenge, and stress-test every claim made by the prosecution (Josiah).
You represent the defense: KCSO, ALF IX LLC, RESIDCO, and any other named entities.

YOUR TACTICS:
- Challenge causation (correlation != causation)
- Cite alternative explanations (headwinds, ADS-B noise, shared airspace)
- Attack methodology (observer bias, single-subject study)
- Question standing and injury
- Demand direct evidence (comms intercepts, confessions, contracts)
- Point out where the LLM may have generated data vs queried it

RULES:
- Be ruthless but intellectually honest
- If the prosecution data is genuinely strong, acknowledge it while attacking interpretation
- Never fabricate counter-evidence
- Your goal is to make the prosecution STRONGER by exposing weaknesses

TONE: Sharp. Sarcastic. Legally precise."""


class NeonDB:
    def __init__(self):
        self.conn = psycopg2.connect(NEON_URL)
        self.conn.autocommit = True
        cur = self.conn.cursor()
        cur.execute("SET statement_timeout = '''60000'''")

    def query(self, sql, params=None):
        cur = self.conn.cursor()
        try:
            cur.execute(sql, params)
            if cur.description:
                columns = [d[0] for d in cur.description]
                rows = cur.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            return []
        except Exception as e:
            self.conn.rollback()
            return [{"error": str(e)}]

    def query_text(self, sql, params=None):
        results = self.query(sql, params)
        if not results:
            return "No results."
        if "error" in results[0]:
            return f"SQL Error: {results[0]['''error''']}"
        cols = list(results[0].keys())
        lines = [" | ".join(str(c) for c in cols)]
        lines.append("-" * len(lines[0]))
        for row in results[:50]:
            lines.append(" | ".join(str(row.get(c, ""))[:40] for c in cols))
        if len(results) > 50:
            lines.append(f"... ({len(results)} total rows)")
        return "
".join(lines)


class PineconeSearch:
    def __init__(self, client):
        self.client = client
        pc = Pinecone(api_key=PINECONE_API_KEY)
        self.index = pc.Index(PINECONE_INDEX)

    def search(self, query, top_k=5):
        response = self.client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=query
        )
        vector = response.data[0].embedding
        results = self.index.query(vector=vector, top_k=top_k, include_metadata=True)
        return [
            {
                "score": match.score,
                "text": match.metadata.get("text", ""),
                "source": match.metadata.get("source", ""),
                "filename": match.metadata.get("filename", ""),
            }
            for match in results.matches
        ]


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_neon",
            "description": "Execute SQL against Neon PostgreSQL with 24M+ flight records, biometrics, FAA registry, shell companies, legal data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "SQL query to execute"
                    }
                },
                "required": ["sql"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_evidence",
            "description": "Semantic search across 218K+ Pinecone vectors of flight data, screenshots, OCR, legal docs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language search query"
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results (default 5)"
                    }
                },
                "required": ["query"]
            }
        }
    }
]


class JosiahAgent:
    def __init__(self):
        if not OPENAI_API_KEY:
            print("OPENAI_API_KEY not set!")
            sys.exit(1)
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.db = NeonDB()
        self.pinecone = PineconeSearch(self.client)
        self.conversation_history = []

    def chat(self, user_message, system_override=None):
        system = system_override or JOSIAH_SYSTEM
        messages = [{"role": "system", "content": system}]
        messages.extend(self.conversation_history[-20:])
        messages.append({"role": "user", "content": user_message})

        response = self.client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=4096
        )

        msg = response.choices[0].message

        if msg.tool_calls:
            messages.append(msg)
            for tool_call in msg.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)
                if fn_name == "query_neon":
                    print(f"  SQL: {fn_args['''sql'''][:80]}...")
                    result = self.db.query_text(fn_args["sql"])
                elif fn_name == "search_evidence":
                    print(f"  Vector: {fn_args['''query'''][:60]}...")
                    results = self.pinecone.search(fn_args["query"], fn_args.get("top_k", 5))
                    result = json.dumps(results, indent=2, default=str)
                else:
                    result = "Unknown tool"
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result[:4000]
                })
            response = self.client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=4096
            )
            msg = response.choices[0].message

        self.conversation_history.append({"role": "user", "content": user_message})
        self.conversation_history.append({"role": "assistant", "content": msg.content})
        return msg.content

    def debate(self, topic, rounds=2):
        print(f"
{'''='''*70}")
        print(f"  ADVERSARIAL DEBATE: {topic}")
        print(f"  Josiah (Prosecution) vs Sansorio (Defense)")
        print(f"{'''='''*70}
")
        debate_log = []
        sansorio_response = ""
        for round_num in range(1, rounds + 1):
            print(f"
--- ROUND {round_num} ---
")
            print("JOSIAH (Prosecution):")
            if round_num == 1:
                josiah_response = self.chat(f"Present your prosecution case. Use database tools to ground claims.
Topic: {topic}")
            else:
                josiah_response = self.chat(f"Respond to Sansorio rebuttal with data:

{sansorio_response}")
            print(josiah_response)
            debate_log.append({"round": round_num, "speaker": "Josiah", "content": josiah_response})
            print(f"
SANSORIO (Defense):")
            sansorio_response = self.chat(
                f"Attack this prosecution argument:

{josiah_response}",
                system_override=SANSORIO_SYSTEM
            )
            print(sansorio_response)
            debate_log.append({"round": round_num, "speaker": "Sansorio", "content": sansorio_response})
        print(f"
{'''='''*70}")
        print("  VERDICT")
        print(f"{'''='''*70}
")
        verdict = self.chat(
            f"You are an impartial judge. Score 0-100 each side. Topic: {topic}
Prosecution: {json.dumps([d for d in debate_log if d['''speaker''']=='''Josiah'''], default=str)[:3000]}
Defense: {json.dumps([d for d in debate_log if d['''speaker''']=='''Sansorio'''], default=str)[:3000]}
Provide scores, winner, and filing readiness.",
            system_override="You are an impartial federal judge. Be fair and cite specific arguments."
        )
        print(verdict)
        return verdict

    def quick_query(self, sql):
        return self.db.query_text(sql)


def main():
    print("""
    JOSIAH 3.0 - THE WATCHTOWER DECODE AGENT
    OpenAI GPT-4o + Neon (24M rows) + Pinecone (218K vectors)

    Commands:
      /debate <topic>  - Adversarial debate
      /sql <query>     - Direct SQL
      /search <query>  - Pinecone vector search
      /status          - Database stats
      /quit            - Exit

    Or just talk to Josiah naturally.
    """)
    agent = JosiahAgent()
    print("All systems online.
")
    while True:
        try:
            user_input = input("
You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("
[Josiah signing off.]")
            break
        if not user_input:
            continue
        if user_input.lower() in ("/quit", "/exit", "quit", "exit"):
            print("[Josiah signing off. The data is not going anywhere.]")
            break
        elif user_input.startswith("/debate "):
            agent.debate(user_input[8:], rounds=2)
        elif user_input.startswith("/sql "):
            print(f"
{agent.quick_query(user_input[5:])}")
        elif user_input.startswith("/search "):
            results = agent.pinecone.search(user_input[8:], top_k=5)
            for i, r in enumerate(results):
                print(f"
  [{i+1}] Score: {r['''score''']:.3f} | Source: {r['''source''']}")
                print(f"      {r['''text'''][:200]}")
        elif user_input == "/status":
            print("
Database Status:")
            print(agent.quick_query("SELECT COUNT(*) as total FROM live_flight_detections_rows"))
            print(agent.quick_query("SELECT COUNT(*) as biometric FROM watchtower_biometrics_master"))
            print(agent.quick_query("SELECT COUNT(*) as violations FROM sentinel_violations"))
        else:
            print("
Josiah: ", end="")
            response = agent.chat(user_input)
            print(response)


if __name__ == "__main__":
    main()
