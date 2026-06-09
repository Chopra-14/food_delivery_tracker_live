import argparse
import random
import json
from datetime import datetime
import sys
import os
from kafka import KafkaProducer
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fixtures import restaurants, customers, menu_items

STATUSES = [
    "PLACED",
    "CONFIRMED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "DELIVERED"
]

parser = argparse.ArgumentParser()

parser.add_argument(
    "--orders",
    type=int,
    default=10,
    help="Number of orders to simulate"
)
producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)
args = parser.parse_args()

print(f"Generating {args.orders} orders...")

for i in range(1, args.orders + 1):

    order_id = f"ORD{i:04d}"

    customer = random.choice(customers)
    restaurant = random.choice(restaurants)
    item = random.choice(menu_items)

    for status in STATUSES:

        event = {
            "order_id": order_id,
            "status": status,
            "customer": customer,
            "restaurant": restaurant,
            "item": item,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        print(f"[SENT] {order_id} -> {status}")
        print(json.dumps(event, indent=2))
for status in STATUSES:

    event = {
        "order_id": order_id,
        "status": status,
        "customer": customer,
        "restaurant": restaurant,
        "item": item,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    producer.send(
        "order-events",
        key=order_id.encode(),
        value=event
    )

    print(f"[SENT] {order_id} -> {status}")
producer.flush()
producer.close()