import json
import sqlite3
import threading
import time
from flask import Flask, jsonify, make_response
from flask_cors import CORS
from kafka import KafkaConsumer

app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "*"}}
)

DB_PATH = "orders.db"
order_state = {}

def init_db():
    """Initializes the SQLite database tables if they do not exist."""
    print("Initializing SQLite Database...")
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute('PRAGMA journal_mode=WAL;')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            customer TEXT NOT NULL,
            restaurant TEXT NOT NULL,
            item TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders (order_id)
        )
    ''')
    conn.commit()
    conn.close()
    print("SQLite Database Initialized.")


def consume_messages():
    consumer = KafkaConsumer(
        "order-events",
        bootstrap_servers="localhost:9092",
        group_id="status-tracker-group",
        auto_offset_reset="earliest",
        value_deserializer=lambda m: json.loads(m.decode("utf-8"))
    )

    print("Kafka Consumer Connected!")

    for message in consumer:
        event = message.value
        order_id = event["order_id"]
        status = event["status"]
        customer = event["customer"]
        restaurant = event["restaurant"]
        item = event["item"]
        timestamp = event["timestamp"]

        # Save to SQLite database
        try:
            conn = sqlite3.connect(DB_PATH, timeout=30.0)
            conn.execute('PRAGMA journal_mode=WAL;')
            cursor = conn.cursor()
            
            # Upsert the order status
            cursor.execute('''
                INSERT INTO orders (order_id, customer, restaurant, item, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                    status=excluded.status,
                    timestamp=excluded.timestamp
            ''', (order_id, customer, restaurant, item, status, timestamp))
            
            # Insert status history transition
            cursor.execute('''
                INSERT INTO order_status_history (order_id, status, timestamp)
                VALUES (?, ?, ?)
            ''', (order_id, status, timestamp))
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error saving event to SQLite: {e}")

        # Update in-memory state (backward compatibility / backup)
        order_state[order_id] = {
            "status": status,
            "customer": customer,
            "restaurant": restaurant,
            "item": item,
            "timestamp": timestamp
        }

        print(f"[RECEIVED] {order_id} -> {status}")


def save_state():
    while True:
        try:
            with open("state.json", "w") as f:
                json.dump(order_state, f, indent=4)
            print("State saved to state.json")
        except Exception as e:
            print(f"Error saving state.json: {e}")
        time.sleep(10)


@app.route("/state", methods=["GET"])
def get_state():
    print("GET /state called")
    try:
        conn = sqlite3.connect(DB_PATH, timeout=30.0)
        conn.execute('PRAGMA journal_mode=WAL;')
        cursor = conn.cursor()
        cursor.execute("SELECT order_id, customer, restaurant, item, status, timestamp FROM orders")
        rows = cursor.fetchall()
        conn.close()
        
        db_orders = {}
        for row in rows:
            db_orders[row[0]] = {
                "customer": row[1],
                "restaurant": row[2],
                "item": row[3],
                "status": row[4],
                "timestamp": row[5]
            }
        response = make_response(jsonify(db_orders))
    except Exception as e:
        print(f"Error in /state API: {e}")
        response = make_response(jsonify(order_state)) # Fallback to in-memory
        
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    print("GET /api/analytics called")
    try:
        conn = sqlite3.connect(DB_PATH, timeout=30.0)
        conn.execute('PRAGMA journal_mode=WAL;')
        cursor = conn.cursor()
        
        # 1. KPI Counts
        cursor.execute("SELECT COUNT(*) FROM orders")
        total_orders = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'DELIVERED'")
        delivered_orders = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM orders WHERE status != 'DELIVERED'")
        active_orders = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT restaurant) FROM orders")
        unique_restaurants = cursor.fetchone()[0]
        
        # 2. Status Distribution (for Pie/Doughnut Chart)
        cursor.execute("SELECT status, COUNT(*) FROM orders GROUP BY status")
        status_counts = dict(cursor.fetchall())
        for s in ["PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]:
            if s not in status_counts:
                status_counts[s] = 0
                
        # 3. Top 5 Restaurants (for Bar Chart)
        cursor.execute("SELECT restaurant, COUNT(*) as count FROM orders GROUP BY restaurant ORDER BY count DESC LIMIT 5")
        top_restaurants = [{"name": row[0], "orders": row[1]} for row in cursor.fetchall()]
        
        # 4. Top 5 Menu Items (for polar/doughnut chart)
        cursor.execute("SELECT item, COUNT(*) as count FROM orders GROUP BY item ORDER BY count DESC LIMIT 5")
        top_items = [{"name": row[0], "orders": row[1]} for row in cursor.fetchall()]
        
        # 5. Order Volume trend (grouped by minute)
        # Using substr(timestamp, 12, 5) extracts HH:MM
        cursor.execute("SELECT substr(timestamp, 12, 5) as minute_bucket, COUNT(*) FROM orders GROUP BY minute_bucket ORDER BY minute_bucket DESC LIMIT 10")
        volume_trend = [{"time": row[0], "orders": row[1]} for row in cursor.fetchall()]
        volume_trend.reverse() # Show in ascending order
        
        # 6. Average delivery duration (in seconds, difference between PLACED and DELIVERED)
        cursor.execute('''
            SELECT h1.order_id, 
                   (julianday(h2.max_delivered) - julianday(h1.min_placed)) * 86400 as duration_sec
            FROM (
                SELECT order_id, MIN(timestamp) as min_placed
                FROM order_status_history
                WHERE status = 'PLACED'
                GROUP BY order_id
            ) h1
            JOIN (
                SELECT order_id, MAX(timestamp) as max_delivered
                FROM order_status_history
                WHERE status = 'DELIVERED'
                GROUP BY order_id
            ) h2 ON h1.order_id = h2.order_id
        ''')
        durations = [row[1] for row in cursor.fetchall()]
        avg_delivery_time = sum(durations) / len(durations) if durations else 0
        
        conn.close()
        
        analytics_data = {
            "kpis": {
                "total_orders": total_orders,
                "delivered_orders": delivered_orders,
                "active_orders": active_orders,
                "unique_restaurants": unique_restaurants,
                "avg_delivery_time": round(avg_delivery_time, 1)
            },
            "status_distribution": status_counts,
            "top_restaurants": top_restaurants,
            "top_items": top_items,
            "volume_trend": volume_trend
        }
        
        response = make_response(jsonify(analytics_data))
    except Exception as e:
        print(f"Error in /api/analytics API: {e}")
        response = make_response(jsonify({"error": str(e)}), 500)
        
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok"
    })


@app.route("/test")
def test():
    return jsonify({"message": "cors test"})


if __name__ == "__main__":
    # Ensure DB is created
    init_db()

    consumer_thread = threading.Thread(
        target=consume_messages,
        daemon=True
    )

    save_thread = threading.Thread(
        target=save_state,
        daemon=True
    )

    consumer_thread.start()
    save_thread.start()

    app.run(
        host="0.0.0.0",
        port=5005
    )

