#!/bin/bash

echo "🚀 Starting MongoDB Index Tuning Demo..."
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🌐 Starting server on http://localhost:3000"
echo ""
echo "📝 Instructions:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Choose to generate 1M (약 2분) or 10M (약 20분) sample data"
echo "3. Run the different scenarios to see index performance"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start

