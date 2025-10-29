# MongoDB Index Tuning Demo

Interactive web application to learn MongoDB index performance optimization with configurable MongoDB Atlas connections.

## Quick Start

### Option 1: Using the startup script
```bash
./start.sh
```

### Option 2: Manual setup
```bash
# Install dependencies
npm install

# Start the server
npm start
```

Then open http://localhost:3000 in your browser.

## Features

The application demonstrates 5 different scenarios:

1. **Scenario 1: No Index vs With Index** - Compare query performance with and without indexes
2. **Scenario 2: Index Order Comparison** - Compare compound index order efficiency
3. **Scenario 3: Index Prefix Comparison** - Compare compound index prefixes (abc vs ab vs a)
4. **Scenario 4: ESR vs ERS** - Compare MongoDB's recommended ESR (Equality, Sort, Range) pattern vs incorrect ERS ordering
5. **Scenario 5: Index Direction** - Compare index direction efficiency for symmetric sort orders

## MongoDB Connection

1. **Enter your MongoDB connection URI** in the web interface (e.g., `mongodb+srv://username:password@cluster.mongodb.net/`)
2. Click **"Connect"** to update the connection
3. The application will use this connection for all operations

## Usage

1. **Connect to MongoDB**: Enter your MongoDB Atlas connection string and click "Connect"
2. **Generate sample data**: Choose either:
   - **1M Sample Data (약 2분)** - Creates 1,000,000 documents for quick testing
   - **10M Sample Data (약 20분)** - Creates 10,000,000 documents for better demonstrations
3. **Check statistics**: Click "Check Statistics" to verify document count
4. **Run scenarios**: Click individual scenario buttons or "Run All Scenarios" to test all strategies
5. **Compare results**: Review execution time, documents examined, and performance metrics

## Sample Data Structure

The generated documents have the following structure:
- name: Product name
- sku: Product SKU
- category: Product category (Electronics, Clothing, Books, etc.)
- brand: Product brand
- supplier: Supplier name
- price: Product price
- stock: Stock quantity
- rating: Product rating
- tags: Array of tags
- createdAt: Creation date
- views: View count
- status: Product status

## Performance Metrics

Each scenario displays:
- **Execution Time**: Query execution time in milliseconds
- **Documents Examined**: Number of documents MongoDB examined
- **Index Keys Examined**: Number of index keys used
- **Documents Returned**: Number of documents returned

## Notes

- Data generation: 1M (~2 min), 10M (~20 min)
- Query performance varies by hardware and data distribution
- Index creation time is included in measurements
- For production, use `db.collection.explain()` on actual queries

