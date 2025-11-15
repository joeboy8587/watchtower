# 🚀 WATCHTOWER - Cyberpunk Command Center

A stunning cyberpunk-themed data command center for managing and visualizing your Neon PostgreSQL database with 400,000+ records.

## ✨ Features

- **🎨 Cyberpunk Aesthetic**: Neon colors, glitch effects, animated scanlines, and grid backgrounds
- **📊 Real-time Dashboard**: Live statistics and database overview
- **🔍 Data Explorer**: Browse and search through your database tables
- **📈 Analytics**: Interactive charts and data visualization
- **⚡ High Performance**: Optimized for handling large datasets
- **🎯 Responsive Design**: Works on desktop, tablet, and mobile

## 🏗️ Architecture

### Backend (Node.js/Express)
- RESTful API with PostgreSQL integration
- WebSocket support for real-time updates
- Dynamic schema discovery
- Advanced querying and search capabilities
- Connection pooling for performance

### Frontend (React + Vite)
- Modern React with hooks
- Cyberpunk-themed custom CSS
- Recharts for data visualization
- Responsive and accessible UI
- Real-time data updates

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Neon PostgreSQL database (connection string provided in `.env`)

### Installation

1. **Install Backend Dependencies**
   \`\`\`bash
   cd backend
   npm install
   \`\`\`

2. **Install Frontend Dependencies**
   \`\`\`bash
   cd frontend
   npm install
   \`\`\`

### Running the Application

1. **Start the Backend Server**
   \`\`\`bash
   cd backend
   npm start
   # Server runs on http://localhost:3001
   \`\`\`

2. **Start the Frontend Development Server**
   \`\`\`bash
   cd frontend
   npm run dev
   # Frontend runs on http://localhost:5173
   \`\`\`

3. **Open your browser** and navigate to `http://localhost:5173`

## 📡 API Endpoints

### Database Information
- `GET /api/health` - Health check
- `GET /api/schema` - Get database schema
- `GET /api/stats` - Get database statistics
- `GET /api/tables/:tableName` - Get table details

### Data Operations
- `POST /api/query` - Execute dynamic queries
- `POST /api/search` - Full-text search
- `GET /api/analytics/:tableName` - Get analytics data

## 🎨 Cyberpunk Theme

The UI features:
- **Neon Colors**: Cyan (#00ffff), Magenta (#ff00ff), Purple (#9d00ff)
- **Animated Grid Background**: Retro-futuristic grid pattern
- **Scanlines**: CRT monitor effect
- **Glitch Effects**: Text glitch animations
- **Custom Scrollbars**: Neon-themed scrollbars
- **Hover Effects**: Interactive neon glow effects

## 🛠️ Development

### Discover Database Schema
\`\`\`bash
cd backend
npm run discover
\`\`\`

This will scan your Neon database and generate a `database-schema.json` file with detailed schema information.

### Build for Production

**Backend:**
\`\`\`bash
cd backend
npm start
\`\`\`

**Frontend:**
\`\`\`bash
cd frontend
npm run build
npm run preview
\`\`\`

## 📦 Project Structure

\`\`\`
watchtower/
├── backend/
│   ├── server.js              # Main server file
│   ├── db.js                  # Database connection pool
│   ├── discover-schema.js     # Schema discovery utility
│   ├── package.json
│   └── .env                   # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx     # Dashboard component
│   │   │   ├── DataExplorer.jsx  # Data browsing component
│   │   │   ├── Analytics.jsx     # Analytics component
│   │   │   └── *.css            # Component styles
│   │   ├── App.jsx           # Main App component
│   │   ├── App.css           # App styles
│   │   ├── index.css         # Global cyberpunk styles
│   │   └── main.jsx          # Entry point
│   ├── package.json
│   └── .env                  # Frontend env variables
└── README.md
\`\`\`

## 🔧 Configuration

### Backend (.env)
\`\`\`env
DATABASE_URL=your_neon_connection_string
PORT=3001
NODE_ENV=development
\`\`\`

### Frontend (.env)
\`\`\`env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
\`\`\`

## 🎯 Features Breakdown

### Dashboard
- Real-time database statistics
- Table overview with row counts
- System information display
- Live clock with neon styling

### Data Explorer
- Browse all tables
- Paginated data viewing
- Full-text search across columns
- Real-time data updates
- Export capabilities (coming soon)

### Analytics
- Interactive bar and pie charts
- Group by any column
- Data distribution analysis
- Top N analysis
- Custom aggregations

## 🚧 Roadmap

- [ ] Real-time WebSocket updates
- [ ] Data export (CSV, JSON, Excel)
- [ ] Advanced filtering
- [ ] Custom queries builder
- [ ] User authentication
- [ ] Data manipulation (CRUD)
- [ ] Dashboard customization
- [ ] Dark/Light theme toggle
- [ ] Mobile app version

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ using React, Node.js, and Neon PostgreSQL**

*Embrace the cyberpunk aesthetic. Watch over your data. 🌃*
