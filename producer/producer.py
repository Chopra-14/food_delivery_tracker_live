import argparse
import random
import json
from datetime import datetime, UTC
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

args = parser.parse_args()

producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)

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
            "timestamp": datetime.now(UTC).isoformat()
        }

        producer.send(
            "order-events",
            key=order_id.encode(),
            value=event
        )

        print(f"[SENT] {order_id} -> {status}")

producer.flush()
producer.close()