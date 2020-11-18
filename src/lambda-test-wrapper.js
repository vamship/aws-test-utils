'use strict';

const _sinon = require('sinon');
const _dotProp = require('dot-prop');
const _clone = require('clone');
const { testValues: _testValues, ObjectMock } = require('@vamship/test-utils');
const { argValidator: _argValidator } = require('@vamship/arg-utils');
const LOG_METHODS = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent',
    'child',
];
const Promise = require('bluebird').Promise;
const DEFAULT_ALIAS = 'default';

/**
 * A testing wrapper for lambda functions specifically designed for handlers
 * that work with @vamship/aws-lambda
 */
class LambdaTestWrapper {
    /**
     * A function that contains the core execution logic of the lambda function.
     * This function receives the input and context from the AWS lambda, along
     * with some extended properties, and can return any value, including a
     * Promise for asynchronous operations.
     *
     * @callback LambdaTestWrapper.Handler
     * @param {Object} event The input to the lambda function, not altered
     *        in any way by the wrapper.
     * @param {Object} contex The
     *        [AWS lambda context]{@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html},
     *        not altered in any way by the wrapper.
     * @param {Object} ext Extended parameters passed to the handler. These
     *        are values injected by the wrapper, providing utility objects
     *        that the handler can optionally utilize.
     * @param {Object} ext.logger A logger object that can be used to write log
     *        messages. The logger object is pre initialized with some metadata
     *        that includes the application name, lambda handler name and the
     *        lamnda execution id. More properties may be added to it if
     *        necessary by invoking <code>logger.child()</code>.
     * @param {String} ext.alias The alias with which the lambda function was
     *        invoked. If the lambda was not invoked unqualified or as latest
     *        version ($LATEST), the alias value will be set to "default".
     *
     * @return {Promise|*} The response from the lambda handler execution. If
     *         a promise is returned, the the wrapper will wait for resolution
     *         or rejection of the promise, and use the corresponding result
     *         as the response value of the lambda.
     */
    /**
     * A mock context object that mimics the
     * [context object]{@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html}
     * that will be passed to the lambda function. This object is initialized
     * with default values to being with, and each property can be modified if
     * necessary by invoking the
     * [setContextProperty()]{@link LambdaTestWrapper#setContextProperty}
     * method.
     *
     * @typedef {Object} LambdaTestWrapper.Context
     * @property {Function} getRemainingTimeInMillis A sinon spy that does
     *           nothing.
     * @property {Boolean} callbackWaitsForEmptyEventLoop Set to true by
     *           default.
     * @property {String} functionName The handler name passed in via the
     *           constructor.
     * @property {String} invokedFunctionArn The ARN of the lambda handler. This
     *           value has multiple components to it. Specific components may
     *           be replaced by using the
     *           [setAlias()]{@link LambdaTestWrapper#setAlias},
     *           [removeAlias()]{@link LambdaTestWrapper#removeAlias},
     *           [setAccountId()]{@link LambdaTestWrapper#setAccountId} and
     *           [setRegion()]{@link LambdaTestWrapper#setAccountId} methods.
     *           Alternatively, the entire arn can be replaced using the
     *           [setContextProperty()]{@link LambdaTestWrapper#setContextProperty}
     *           method.
     * @property {Number} memoryLimitInMB Defaults to 128
     * @property {String} awsRequestId An auto generated unique id.
     * @property {String} logGroupName Defaults to /aws/lambda/<function name>
     * @property {String} logStreamName An auto generated unique id.
     */
    /**
     * @param {String} functionName The lambda function name.
     * @param {LambdaTestWrapper.Handler} handler The handler that is under
     *        test.
     * @param {Object} [event={}] An optional event object that represents the
     *        input to the lambda function.
     */
    constructor(functionName, handler, event) {
        _argValidator.checkString(
            functionName,
            1,
            'Invalid functionName (arg #1)'
        );
        _argValidator.checkFunction(handler, 'Invalid handler (arg #2)');
        if (!_argValidator.checkObject(event)) {
            event = {};
        }

        this._functionName = functionName;
        const region = _testValues.getString('region');
        const accountId = '123456789012';

        this._handler = handler;
        this._event = _clone(event);
        this._context = {
            getRemainingTimeInMillis: _sinon.spy(),
            callbackWaitsForEmptyEventLoop: true,
            functionName,
            invokedFunctionArn: `arn:aws:lambda:${region}:${accountId}:function:${this._functionName}:$LATEST`,
            memoryLimitInMB: 128,
            awsRequestId: _testValues.getString('awsRequestId'),
            logGroupName: `/aws/lambda/${this._functionName}`,
            logStreamName: _testValues.getString('logStreamName'),
        };
    }

    /**
     * Replaces a specific token within the invokedFunctionArn string.
     *
     * @private
     * @param {Number} index The index position at which the replacement will be
     *        made.
     * @param {String} value The token value to replace.
     */
    _replaceArnToken(index, value) {
        const { invokedFunctionArn } = this._context;
        const tokens = invokedFunctionArn.split(':');
        tokens[index] = value;
        this._context.invokedFunctionArn = tokens.join(':');
    }

    /**
     * The name of the lambda function that is under test.
     *
     * @type {String}
     */
    get functionName() {
        return this._functionName;
    }

    /**
     * Reference to the lambda handler that is under test.
     *
     * @type {LambdaTestWrapper.Handler}
     */
    get handler() {
        return this._handler;
    }

    /**
     * The event object that will be sent to the lambda. This value is initially
     * set to an empty object. Additional properties may be added by invoking
     * the [setEventProperty()]{@link LambdaTestWrapper#setEventProperty}
     * method.
     *
     * @type {Object}
     */
    get event() {
        return this._event;
    }

    /**
     * The context object that will be sent to the lambda.
     *
     * @type {LambdaTestWrapper.Context}
     */
    get context() {
        return this._context;
    }

    /**
     * Sets a single property on the event object. This allows the user to set
     * the lambda inputs prior to invoking the handler.
     *
     * @param {String} property The name of the property to set. Dot separated
     *        values can be used to target nested properties.
     * @param {*} value The value to assign to the specific property.
     *
     * @return {LambdaTestWrapper} A reference to the wrapper object, enabling
     *         object chaining.
     */
    setEventProperty(property, value) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _dotProp.set(this._event, property, value);

        return this;
    }

    /**
     * Sets a single property on the context . This allows the user to set
     * the lambda context values prior to invoking the handler. In addition to
     * explicitly setting context objects, utility methods such as
     * [setAlias()]{@link LambdaTestWrapper#setAlias},
     * [removeAlias()]{@link LambdaTestWrapper#removeAlias},
     * [setAccountId()]{@link LambdaTestWrapper#setAccountId} and
     * [setRegion()]{@link LambdaTestWrapper#setAccountId} to set specific
     * values on the invokedFunctionArn property.
     *
     * @param {String} property The name of the property to set. Dot separated
     *        values can be used to target nested properties.
     * @param {*} value The value to assign to the specific property.
     *
     * @return {LambdaTestWrapper} A reference to the wrapper object, enabling
     *         object chaining.
     */
    setContextProperty(property, value) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _dotProp.set(this._context, property, value);

        return this;
    }

    /**
     * Removes the alias value from the invokedFunctionArn
     *
     * @return {LambdaTestWrapper} A reference to the wrapper object, enabling
     *         object chaining.
     */
    removeAlias() {
        const { invokedFunctionArn } = this._context;
        const tokens = invokedFunctionArn.split(':');
        if (tokens.length === 8) {
            tokens.pop();
        }
        this._context.invokedFunctionArn = tokens.join(':');
        return this;
    }

    /**
     * Sets the alias on the invokedFunctionArn property of the lambda's context
     * object. If set to undefined, the alias will be removed from the arn
     * completely.
     *
     * @param {String|undefined} alias The alias value to set for the lambda's
     *        invoked ARN.
     *
     * @return {LambdaTestWrapper} A reference to the wrapper object, enabling
     *         object chaining.
     */
    setAlias(alias) {
        _argValidator.checkString(alias, 1, 'Invalid alias (arg #1)');
        this._replaceArnToken(7, alias);
        return this;
    }

    /**
     * Sets the region on the invokedFunctionArn property of the lambda's
     * context object.
     *
     * @param {String} region The region value to set for the lambda's invoked
     *        ARN.
     *
     * @return {LambdaTestWrapper} A reference to the wrapper object, enabling
     *         object chaining.
     */
    setRegion(region) {
        _argValidator.checkString(region, 1, 'Invalid region (arg #1)');
        this._replaceArnToken(3, region);
        return this;
    }

    /**
     * Sets the accountId on the invokedFunctionArn property of the lambda's
     * context object.
     *
     * @param {String} accountId The accountId value to set for the lambda's
     *        invoked ARN.
     *
     * @return {LambdaTestWrapper} A reference to the wrapper object, enabling
     *         object chaining.
     */
    setAccountId(region) {
        _argValidator.checkString(region, 1, 'Invalid accountId (arg #1)');
        this._replaceArnToken(4, region);
        return this;
    }

    /**
     * Creates a clone of the current wrapper, replicating the input and context
     * objects, but not any promises or execution state.
     *
     * @return {LambdaTestWrapper} A reference to a cloned copy of the wrapper
     *         object.
     */
    clone() {
        return new LambdaTestWrapper(
            this._functionName,
            this._handler,
            this._event
        );
    }

    /**
     * Creates the lambda event, context and extended properties, and invokes
     * the handler.
     *
     * @return {Promise} A promise that will be rejected or resolved based on
     *         the outcome of handler execution.
     */
    invoke() {
        const logger = LOG_METHODS.reduce((result, method) => {
            result[method] = _sinon.spy();
            return result;
        }, new ObjectMock());

        let alias = this._context.invokedFunctionArn.split(':')[7];
        if (typeof alias === 'undefined' || alias === '$LATEST') {
            alias = DEFAULT_ALIAS;
        }

        return Promise.try(() => {
            return this.handler(this._event, this._context, {
                logger,
                alias,
            });
        });
    }
}

module.exports = LambdaTestWrapper;
