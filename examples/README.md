# fluent-amqp examples

To run the examples:

  1. Run `npm install`
  2. Run `docker-compose up`
  3. Open RabbitMQ Management on [http://localhost:8080/](http://localhost:8080/)

## simple

This will send a simple message on the queue `hello`

  * In terminal window 1, run `node simple/recieve`
  * In terminal window 2, run `node simple/send Hello there!`

## pubsub

This will create an exchange called `logs` and two named, non exclusive channels
called `channel_a` and `channel_b`. It will also open an anonymous, exclusive third
channel. Try stopping the named channels and starting them again while sending messages.
Notice that they are picked up even if the channel was down while the message was sent.
When you close the anonymous channel, notice how it disappears in the Management window.

  * In terminal window 1, run `node pubsub/subscribe channel_a`
  * In terminal window 2, run `node pubsub/subscribe channel_b`
  * In terminal window 3, run `node pubsub/subscribe`
  * In terminal window 4, run `node pubsub/publish Hello everybody!`
