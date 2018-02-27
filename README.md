# aws-test-utils

_Library containing test utilities for AWS specific entities - lambda functions,
dynamodb, etc. This library is designed to work well with
[@vamship/aws-lambda](https://github.com/vamshi/aws-lambda)_

This does not include actual test assertions, but provides utility methods that
can be used to setup commonly used test scenarios.

## Motivation

When unit testing any entity designed to work on an existing platform or
framework, a significant amount of work is usually necessary to setup the object
under test. Typically, this involves mocking out components supplied by the
framework/platform, and providing meaningful values for configuration and
context objects.

For example, an AWS Lambda handler is no different than a regular node.js
function, but requires that the event object and context object be configured
and passed in for it to work correctly. While this is usually simple, it does
become repetitive as more and more tests are written against the lambda
handler.

Most developers recognize this repeating pattern, and in the spirit of
[keeping things DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself),
develop reusable scaffolding that can be used multiple times, without having to
copy and paste huge chunks of code.

This library encapsulates components that attempt to do something similar,
specifically in the context of AWS components. The key idea is to enable the
development of AWS lambda functions using the framework provided by
[@vamship/aws-lambda](https://github.com/vamshi/aws-lambda).

## Installation

This library can be installed using npm:

```
npm install @vamship/aws-test-utils
```

## Usage

### Using the library

This library is mainly intended for writing test cases, and provides some
utility classes:

#### LambdaTestWrapper Class:

This class is designed to wrap a lambda handler and provide easy methods to
configure the `event`, `context` and `extension` objects required by the
handler. While the `event` and `context` objects are standard, the extension
object is injected by the `HandlerWrapper` class from
[@vamship/aws-lambda](https://github.com/vamshi/aws-lambda).

```
const {LambdaTestWrapper} = require('@vamship/aws-test-utils');
const handler = require('../../src/handlers/handler');

describe('MyLambda', () => {

...
    it('should return the sum of two numbers', (done) => {
        const wrapper = new LambdaTestWrapper('myLambda', handler);

        // You can also set this up via the constructor above.
        wrapper.setEventProperty('first', 1);
        wrapper.setEventProperty('second', 2);

        wrapper.invoke().then((result) => {
            expect(result).to.equal(2);
        }).then(done, done);
    });

    it('should access the remote host using config data', (done) => {
        const wrapper = new LambdaTestWrapper('myLambda', handler);
        const hostUrl = 'example.com';

        // You can also set this up via the constructor above.
        wrapper.setConfigProperty('host.url', hostUrl);

        wrapper.invoke().then((result) => {
            // Write some tests here to see if the handler actually
            // made a call to hostUrl
        }).then(done, done);
    });

...
```

#### InputValidator Class:

This class is designed to work with the `LambdaTestWrapper` class, generating
input values for the handler that can be used to test schema validation behavior
of the lambda function.

```
const {LambdaTestWrapper, InputValidator} = require('@vamship/aws-test-utils');
const handler = require('../../src/handlers/handler');

describe('MyLambda', () => {

...
    it('should throw an error if the input does not define a user object', (done) => {
        const wrapper = new LambdaTestWrapper('myLambda', handler);
        const validator = new InputValidator(wrapper);

        // The callback will be called repeatedly with different values for the
        // "user" property. Each value will be invalid, which means that the
        // handler must throw an error every time.
        validator.checkRequiredObject('user', (wrapper, type, pattern) => {
            expect(wrapper.invoke).to.throw(type, pattern);
        }).then(done, done);
    });
...
```

## Note on Integration

It is generally a good practice when developing libraries to have them loosely
coupled with other libraries, and avoiding tight integration with other
components. While this library does avoid tight integrations, there are implicit
assumptions, at least for some of the components, that the library will be used
with other libraries/frameworks, such as
[@vamship/aws-lambda](https://github.com/vamshi/aws-lambda).

While this integration may make this library less applicable to more generic
usage scenarios, there is still significant reuse value for this library,
especially given that number of lambda functions that will be developed. Also,
[@vamship/aws-lambda](https://github.com/vamshi/aws-lambda) is actually pretty
good, so I'd encourage you to give it a go :).
