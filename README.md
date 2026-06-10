# Food Delivery Order Tracker

A real-time Food Delivery Order Tracking System built using Apache Kafka, Python, Flask, and a simple frontend dashboard.

---

## Architecture

Producer → Kafka Topic (`order-events`) → Consumer A (State Tracker + API) → Frontend

Producer → Kafka Topic (`order-events`) → Consumer B (Analytics)

Components:

* Kafka Producer
* Kafka Topic (`order-events`)
* Consumer A (Status Tracker)
* Consumer B (Analytics Engine)
* Flask API
* Frontend Dashboard
* Kafdrop Monitoring UI

---

## Setup

### Clone Repository

```bash
git clone <repository-url>
cd food-delivery-order-tracker
```

### Install Dependencies

```bash
pip install kafka-python
pip install flask
pip install flask-cors
```

### Start Kafka Environment

```bash
docker compose up -d
```

Verify Kafdrop:

```text
http://localhost:9000
```

---

## Topic Creation

Create Kafka Topic:

```bash
docker exec kafka kafka-topics \
--create \
--topic order-events \
--bootstrap-server kafka:9092 \
--partitions 3 \
--replication-factor 1
```

Verify:

```bash
docker exec kafka kafka-topics \
--list \
--bootstrap-server kafka:9092
```

Expected:

```text
order-events
```

---

## Run Producer

Generate sample orders:

```bash
python producer/producer.py --orders 3
```

Output:

```text
[SENT] ORD0001 -> PLACED
[SENT] ORD0001 -> CONFIRMED
...
[SENT] ORD0003 -> DELIVERED
```

---

## Run Consumer A

Start Consumer A:

```bash
python consumer_a/consumer_a.py
```

Features:

* Consumes Kafka events
* Maintains latest order state
* Exposes REST API
* Saves state.json every 10 seconds

API Endpoint:

```text
http://localhost:5000/state
```

---

## Run Consumer B

Start Consumer B:

```bash
python consumer_b/consumer_b.py
```

Features:

* Consumes Kafka events
* Tracks analytics counters
* Prints analytics snapshots

Example:

```text
PLACED: 3
CONFIRMED: 3
PREPARING: 3
OUT_FOR_DELIVERY: 3
DELIVERED: 3
```

---

## Run Frontend

Open:

```text
frontend/index.html
```

or use Live Server.

Dashboard displays:

* Order ID
* Customer
* Restaurant
* Item
* Status

---

## Testing

### Start Services

Terminal 1:

```bash
docker compose up
```

Terminal 2:

```bash
python consumer_a/consumer_a.py
```

Terminal 3:

```bash
python consumer_b/consumer_b.py
```

Terminal 4:

```bash
python producer/producer.py --orders 3
```

### Verification

* Producer sends 15 messages
* Kafdrop displays events
* Consumer A updates state
* state.json updates every 10 seconds
* Consumer B prints analytics
* Frontend displays orders

---

### Message Key Rationale

Kafka messages use:

```python
key=order_id.encode()
```

Reason:

* Same order always goes to the same partition
* Event ordering is maintained
* Status progression remains correct
* Consumers process events in sequence

Example:

```text
ORD0001
PLACED
CONFIRMED
PREPARING
OUT_FOR_DELIVERY
DELIVERED
```

All events for a given order stay ordered within a single partition.


## Architecture Diagram


                    +----------------+
                    |    Producer    |
                    +--------+-------+
                             |
                             v
                    +----------------+
                    |  Kafka Topic   |
                    | order-events   |
                    +--------+-------+
                             |
            +----------------+----------------+
            |                                 |
            v                                 v

    +---------------+                +---------------+
    |  Consumer A   |                |  Consumer B   |
    | StatusTracker |                |  Analytics    |
    +-------+-------+                +-------+-------+
            |                                |
            v                                v

    +---------------+                +---------------+
    | Flask API     |                | Status Counts |
    | /state        |                | Snapshots     |
    | /health       |                +---------------+
    +-------+-------+
            |
            v

    +---------------+
    | Frontend UI   |
    | Dashboard     |
    +---------------+Architecture Diagram
                    +----------------+
                    |    Producer    |
                    +--------+-------+
                             |
                             v
                    +----------------+
                    |  Kafka Topic   |
                    | order-events   |
                    +--------+-------+
                             |
            +----------------+----------------+
            |                                 |
            v                                 v

    +---------------+                +---------------+
    |  Consumer A   |                |  Consumer B   |
    | StatusTracker |                |  Analytics    |
    +-------+-------+                +-------+-------+
            |                                |
            v                                v

    +---------------+                +---------------+
    | Flask API     |                | Status Counts |
    | /state        |                | Snapshots     |
    | /health       |                +---------------+
    +-------+-------+
            |
            v

    +---------------+
    | Frontend UI   |
    | Dashboard     |
    +---------------+