'use strict';

const Promise = require('bluebird').Promise;
const { argValidator: _argValidator } = require('@vamship/arg-utils');
const { testValues: _testValues } = require('@vamship/test-utils');
const { SchemaError } = require('@vamship/error-types').args;
const LambdaTestWrapper = require('./lambda-test-wrapper');

/**
 * Provides methods that generate input validation test scenarios for lambda
 * function handlers. The methods generate inputs to the lambda handler that
 * should result in errors (schema errors, etc.), and delegate the actual test
 * assertions to a callback handler.
 *
 * Each test generates multiple inputs, invoking tests for each input. The
 * promises from each test is combined into a single promise, which is returned.
 */
class InputValidator {
    /**
     * A function that performs assertion checks on the lambda for a specific
     * set of inputs. The callback function is expected to perform the necessary
     * tests, using the test framework/assertion library of choice.
     *
     * @callback InputValidator.Tester
     * @param {Function} wrapper A reference to the lambda wrapper that wraps
     *        the handler. The [invoke()]{@link LambdaTestWrapper#invoke} method
     *        should throw an error for the test case to pass.
     * @param {Function} type The type of error that is expected to be thrown.
     *        This is a guideline, and can be overridden by the implementation
     *        of the tester method.
     * @param {RegExp} message A regular expression pattern that should match
     *        the error message thrown by the wrapper. This is a guideline, and
     *        can be overridden within the tester method.
     *
     * @return {Promise|*} The response from the tester function. If a promise
     *         is returned, the the test routine will wait for resolution or
     *         rejection of the promise, and use the corresponding result as the
     *         response value of the test.
     */
    /**
     * @param {LambdaTestWrapper} wrapper A wrapper object that is configured
     *        with a valid (non-failing) event object. The properties within
     *        this object will be selectively replaced with failing values
     *        during tests.
     */
    constructor(wrapper) {
        _argValidator.checkInstance(
            wrapper,
            LambdaTestWrapper,
            'Invalid test wrapper (arg #1)'
        );

        this._wrapper = wrapper;
    }

    /**
     * Run tests against a lambda handler by modifying specific properties with
     * the provided list of input values.
     *
     * @private
     * @param {String} property The name of the property to modify
     * @param {Array} inputs The input values to apply to the property
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    _runChecks(property, inputs, tester) {
        const tokens = property.split('.');
        const propertyName = tokens[tokens.length - 1];
        const message = new RegExp(
            `Schema validation failed. Details: \\[.*${propertyName}.*\\]`
        );

        return Promise.map(inputs, (value) => {
            const wrapper = this._wrapper.clone();
            wrapper.setEventProperty(property, value);
            return tester(wrapper, SchemaError, message);
        });
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains a required string property.
     *
     * @param {String} property The name of the property to test. This can be
     *        a dot separated string for nested properties.
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkRequiredString(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues.allButString().concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains an optional string property.
     *
     * @param {String} property The name of the property to test. This can be
     *        a dot separated string for nested properties.
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkOptionalString(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues
            .allButSelected('undefined', 'string')
            .concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains a required number property.
     *
     * @param {String} property The name of the property to test
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkRequiredNumber(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues.allButNumber().concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains an optional number property.
     *
     * @param {String} property The name of the property to test. This can be
     *        a dot separated string for nested properties.
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkOptionalNumber(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues
            .allButSelected('undefined', 'number')
            .concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains a required boolean property.
     *
     * @param {String} property The name of the property to test
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkRequiredBoolean(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues.allButBoolean().concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains an optional boolean property.
     *
     * @param {String} property The name of the property to test. This can be
     *        a dot separated string for nested properties.
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkOptionalBoolean(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues
            .allButSelected('undefined', 'boolean')
            .concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains a required object property.
     *
     * @param {String} property The name of the property to test
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkRequiredObject(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues.allButObject().concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains an optional object property.
     *
     * @param {String} property The name of the property to test. This can be
     *        a dot separated string for nested properties.
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkOptionalObject(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues
            .allButSelected('undefined', 'object')
            .concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains a required array property.
     *
     * @param {String} property The name of the property to test
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkRequiredArray(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues.allButArray().concat(extras);
        return this._runChecks(property, inputs, tester);
    }

    /**
     * Generates test inputs that can be used to validate if the lambda input
     * contains an optional array property.
     *
     * @param {String} property The name of the property to test. This can be
     *        a dot separated string for nested properties.
     * @param {InputValidator.Tester} tester A callback function that will be
     *        invoked for each test input.
     * @param {Array} extras Additional parameters to be included in the test.
     *
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of all test cases.
     */
    checkOptionalArray(property, tester, extras) {
        _argValidator.checkString(property, 1, 'Invalid property (arg #1)');
        _argValidator.checkFunction(tester, 'Invalid tester (arg #1)');
        if (!_argValidator.checkArray(extras)) {
            extras = [];
        }

        const inputs = _testValues
            .allButSelected('undefined', 'array')
            .concat(extras);
        return this._runChecks(property, inputs, tester);
    }
}

module.exports = InputValidator;
