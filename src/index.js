'use strict';

/**
 * Library containing test utilities for AWS specific entities - lambda
 * functions, dynamodb, etc.
 */
module.exports = {
    /**
     * A wrapper object for lambda function testing.
     */
    LambdaTestWrapper: require('./lambda-test-wrapper'),

    /**
     * Class to perform input tests against a lambda wrapper.
     */
    InputValidator: require('./input-validator')
};
