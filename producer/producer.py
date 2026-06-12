"""
producer.py — Simulates a live food delivery order stream.

Each order travels through the full lifecycle:
  PLACED → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED

New orders are created every few seconds, and existing orders
advance through statuses in the background — making the dashboard
fully dynamic and live.

Run:
    python producer.py
"""

import json
import random
import time
import threading
from datetime import datetime, timezone
from kafka import KafkaProducer

# ── Fixtures ────────────────────────────────────────────────────────────────

restaurants = [
    "Pizza Palace", "Burger Hub", "Spice Junction", "Tandoori Treats",
    "Food Fiesta", "Urban Bites", "The Curry House", "South Delights",
    "North Kitchen", "BBQ Nation", "Royal Feast", "Ocean Grill",
    "Taste Express", "Hungry Bowl", "Fresh Fork", "Street Eats",
    "Biryani Corner", "Pasta Point", "Wrap World", "Golden Spoon",
    "Chinese Wok", "Cafe Aroma", "Dosa Factory", "Sizzling Plate",
    "Fusion Flavors"
]

customers = [
    "Rahul Sharma", "Priya Reddy", "Arjun Kumar", "Sneha Patel",
    "Rohan Gupta", "Ananya Singh", "Vikram Rao", "Pooja Verma",
    "Kiran Kumar", "Neha Joshi", "Amit Yadav", "Divya Nair",
    "Sandeep Das", "Meera Kapoor", "Nikhil Jain", "Lakshmi Devi",
    "Harsha Vardhan", "Bhavana Rao", "Manoj Kumar", "Kavya Reddy",
    "Suresh Babu", "Deepika Sharma", "Tarun Teja", "Akhil Krishna",
    "Nandini Roy", "Varun Sai", "Ritika Sharma", "Aditya Verma",
    "Shreya Gupta", "Yash Patel", "Keerthi Reddy", "Abhishek Singh",
    "Pallavi Nair", "Mohan Krishna", "Anjali Mehta"
]

menu_items = [
    "Margherita Pizza", "Pepperoni Pizza", "Veg Burger", "Chicken Burger",
    "French Fries", "Garlic Bread", "Paneer Wrap", "Chicken Wrap",
    "Veg Sandwich", "Club Sandwich", "Masala Dosa", "Plain Dosa",
    "Idli", "Vada", "Paneer Butter Masala", "Butter Chicken",
    "Chicken Biryani", "Veg Biryani", "Mutton Biryani", "Fried Rice",
    "Noodles", "Manchurian", "Spring Rolls", "Pasta Alfredo",
    "Pasta Arrabbiata", "Caesar Salad", "Tandoori Chicken", "Chicken Tikka",
    "Paneer Tikka", "Dal Tadka", "Jeera Rice", "Roti", "Naan",
    "Chole Bhature", "Pav Bhaji", "Samosa", "Momos", "Chocolate Cake",
    "Brownie", "Cold Coffee", "Mango Smoothie"
]

# ── Status lifecycle ─────────────────────────────────────────────────────────

STATUS_FLOW = [
    "PLACED",
    "CONFIRMED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "DELIVERED"
]

# Seconds between each status transition (randomised per order)
STATUS_DELAYS = {
    "PLACED":            (4,  8),   # → CONFIRMED
    "CONFIRMED":         (5, 10),   # → PREPARING
    "PREPARING":         (8, 15),   # → OUT_FOR_DELIVERY
    "OUT_FOR_DELIVERY":  (8, 14),   # → DELIVERED
}

# ── Kafka setup ──────────────────────────────────────────────────────────────

TOPIC = "order-events"
BOOTSTRAP = "localhost:9092"

def create_producer():
    while True:
        try:
            p = KafkaProducer(
                bootstrap_servers=BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8")
            )
            print("✅  Kafka producer connected.")
            return p
        except Exception as e:
            print(f"⏳  Waiting for Kafka... ({e})")
            time.sleep(3)

producer = create_producer()

# ── Order counter ────────────────────────────────────────────────────────────

order_lock   = threading.Lock()
order_counter = [0]   # use list so threads can mutate

def next_order_id():
    with order_lock:
        order_counter[0] += 1
        return f"ORD{order_counter[0]:04d}"

# ── Publish a single event ────────────────────────────────────────────────────

def publish(order_id, status, customer, restaurant, item):
    event = {
        "order_id":   order_id,
        "status":     status,
        "customer":   customer,
        "restaurant": restaurant,
        "item":       item,
        "timestamp":  datetime.now(timezone.utc).isoformat()
    }
    producer.send(TOPIC, event)
    producer.flush()
    print(f"  📤  {order_id}  →  {status:<20}  ({customer})")

# ── Order lifecycle in its own thread ────────────────────────────────────────

def run_order_lifecycle(order_id, customer, restaurant, item):
    for status in STATUS_FLOW:
        publish(order_id, status, customer, restaurant, item)
        if status in STATUS_DELAYS:
            lo, hi = STATUS_DELAYS[status]
            time.sleep(random.uniform(lo, hi))

# ── Main loop: spawn new orders continuously ──────────────────────────────────

def main():
    print("🚀  Producer started — orders will flow every few seconds.")
    print(f"    Topic : {TOPIC}")
    print(f"    Broker: {BOOTSTRAP}\n")

    NEW_ORDER_INTERVAL = (3, 7)   # seconds between new orders

    while True:
        order_id   = next_order_id()
        customer   = random.choice(customers)
        restaurant = random.choice(restaurants)
        item       = random.choice(menu_items)

        t = threading.Thread(
            target=run_order_lifecycle,
            args=(order_id, customer, restaurant, item),
            daemon=True
        )
        t.start()

        wait = random.uniform(*NEW_ORDER_INTERVAL)
        time.sleep(wait)

if __name__ == "__main__":
    main()
