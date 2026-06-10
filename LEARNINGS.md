# LEARNINGS

## Offset Experiment Findings

During development, I experimented with Kafka consumer offsets and consumer groups.

Observations:

* When a new consumer group was created, Kafka replayed all existing messages from the topic because `auto_offset_reset="earliest"` was used.
* Restarting a consumer with the same consumer group continued from the last committed offset.
* Using a different consumer group allowed reprocessing historical messages without affecting other consumers.
* Consumer A and Consumer B were able to consume the same topic independently because they belonged to different consumer groups.

Example:

* Consumer Group: `status-tracker-group`
* Consumer Group: `analytics-group`

Both consumers received the same events while maintaining separate offsets.

---

## Guided Checkpoints

The project was completed through the following checkpoints:

### Checkpoint 1

Kafka environment setup completed.

* Docker Compose configured
* Zookeeper running
* Kafka broker running
* Kafdrop running

### Checkpoint 2

Topic configuration completed.

* Topic: `order-events`
* Partitions: `3`
* Retention: `3600000 ms`

### Checkpoint 3

Producer implementation completed.

* Generated order events
* Used JSON messages
* Implemented order status workflow
* Used Kafka message keys

### Checkpoint 4

Consumer A implementation completed.

* Consumed Kafka events
* Maintained latest order state
* Built Flask API
* Saved state.json periodically

### Checkpoint 5

Consumer B implementation completed.

* Consumed Kafka events
* Tracked analytics counters
* Generated analytics snapshots

### Checkpoint 6

Frontend dashboard completed.

* Displayed order information
* Rendered order table
* Showed latest order statuses

### Checkpoint 7

Testing and validation completed.

* Producer verified
* Consumers verified
* API verified
* Dashboard verified

---

## Kafka Concepts Learned

### Producer

Kafka producers publish messages to topics.

In this project:

* Producer generated food delivery events.
* Messages were sent to the `order-events` topic.

### Topic

A Kafka topic stores streams of events.

In this project:

* Topic Name: `order-events`

### Partitions

Partitions provide scalability and ordering.

In this project:

* 3 partitions were configured.

### Consumer Groups

Consumer groups enable independent processing.

In this project:

* `status-tracker-group`
* `analytics-group`

Both consumed the same topic independently.

### Message Keys

Message keys determine partition assignment.

Used:

```python
key=order_id.encode()
```

Benefits:

* Same order stays in the same partition.
* Status order is preserved.

### Offsets

Offsets track consumer progress.

Kafka stores offsets for each consumer group separately.

---

## Challenges Faced

### Kafka Connectivity Issues

Initially faced broker connectivity and metadata update issues.

Resolution:

* Corrected Kafka advertised listeners.
* Restarted Kafka services.

### Consumer Offset Behavior

Messages appeared repeatedly when new consumer groups were used.

Resolution:

* Learned how Kafka offset management works.
* Tested with different consumer groups.

### Frontend API Integration

Encountered browser CORS issues while accessing the Flask API.

Resolution:

* Investigated Flask-CORS configuration.
* Verified API functionality independently.

### State Persistence

Ensuring state updates were saved correctly required periodic background processing.

Resolution:

* Implemented a dedicated thread to update `state.json` every 10 seconds.

---

## Key Takeaways

* Kafka enables real-time event-driven architectures.
* Consumer groups allow multiple applications to process the same data independently.
* Message keys are essential for preserving event ordering.
* Offsets are critical for reliable message processing.
* Flask can be used to expose Kafka-consumed data through REST APIs.
* Kafdrop is useful for monitoring Kafka topics and messages.
* Building a complete pipeline requires integration of producers, consumers, APIs, storage, and frontend components.
* Testing each component individually simplifies debugging and improves reliability.

Overall, this project provided practical experience with Apache Kafka, event streaming, consumer groups, offsets, message partitioning, Flask APIs, and real-time dashboard development.
