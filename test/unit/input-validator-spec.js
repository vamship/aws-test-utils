'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _rewire = require('rewire');
const _dotProp = require('dot-prop');
const { testValues: _testValues } = require('@vamship/test-utils');
const { ArgError, SchemaError } = require('@vamship/error-types').args;

const LambdaTestWrapper = require('../../src/lambda-test-wrapper');
let InputValidator = null;

describe('InputValidator', () => {
    function _createLambdaTestWrapper(functionName, handler, event, config) {
        functionName = functionName || _testValues.getString('functionName');
        handler = handler || _sinon.spy();
        event = event || {};
        config = config || {};
        return new LambdaTestWrapper(functionName, handler, event, config);
    }

    function _createInputValidator(wrapper) {
        wrapper = wrapper || _createLambdaTestWrapper();
        return new InputValidator(wrapper);
    }

    function _getType(value) {
        if (value === null) {
            return 'null';
        } else if (value === undefined) {
            return 'undefined';
        } else if (value instanceof Array) {
            return 'array';
        } else {
            return typeof value;
        }
    }

    function _getInputTestSuite(invoke) {
        return () => {
            it('should throw an error if invoked without a valid property', () => {
                const message = 'Invalid property (arg #1)';
                const inputs = _testValues.allButString('');

                inputs.forEach((property) => {
                    const wrapper = () => {
                        const validator = _createInputValidator();
                        return invoke(validator, property);
                    };
                    expect(wrapper).to.throw(ArgError, message);
                });
            });

            it('should throw an error if invoked without a valid tester', () => {
                const message = 'Invalid tester (arg #1)';
                const inputs = _testValues.allButFunction();

                inputs.forEach((tester) => {
                    const wrapper = () => {
                        const validator = _createInputValidator();
                        const property = _testValues.getString('property');
                        return invoke(validator, property, tester);
                    };
                    expect(wrapper).to.throw(ArgError, message);
                });
            });
        };
    }

    function _getResponseTestSuite(invoke) {
        return () => {
            it('should return a promise when invoked', () => {
                const validator = _createInputValidator();
                const property = _testValues.getString('property');
                const tester = _sinon.spy();

                const ret = invoke(validator, property, tester);

                expect(ret).to.be.an('object');
                expect(ret.then).to.be.a('function');
            });

            it('should reject the promise if the tester throws an error', (done) => {
                const error = new Error('something went wrong!');
                const validator = _createInputValidator();
                const property = _testValues.getString('property');
                const tester = _sinon.stub();
                tester.onCall(0).returns('');
                tester.onCall(1).throws(error);
                tester.onCall(2).throws(error);

                const promise = invoke(validator, property, tester);
                expect(promise).to.be.rejectedWith(error).and.notify(done);
            });

            it('should resolve the promise if all tester calls complete successfully', (done) => {
                const validator = _createInputValidator();
                const property = _testValues.getString('property');
                const tester = _sinon.stub();

                const promise = invoke(validator, property, tester);
                expect(promise).to.be.fulfilled.and.notify(done);
            });

            it('should reject the promise if the tester returns a promise that is rejected', (done) => {
                const error = new Error('something went wrong!');
                const validator = _createInputValidator();
                const property = _testValues.getString('property');
                const tester = _sinon.stub();
                tester.onCall(0).returns('');
                tester.onCall(1).rejects(error);
                tester.onCall(2).rejects(error);

                const promise = invoke(validator, property, tester);
                expect(promise).to.be.rejectedWith(error).and.notify(done);
            });
        };
    }

    beforeEach(() => {
        InputValidator = _rewire('../../src/input-validator');
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid handler wrapper', () => {
            const message = 'Invalid test wrapper (arg #1)';
            const inputs = _testValues.allButObject({});

            inputs.forEach((testWrapper) => {
                const wrapper = () => {
                    return new InputValidator(testWrapper);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should expose the expected methods and properties', () => {
            const functionName = _testValues.getString('functionName');
            const handler = _sinon.spy();
            const wrapper = new LambdaTestWrapper(functionName, handler);
            const validator = new InputValidator(wrapper);

            expect(validator.checkRequiredString).to.be.a('function');
            expect(validator.checkOptionalString).to.be.a('function');

            expect(validator.checkRequiredNumber).to.be.a('function');
            expect(validator.checkOptionalNumber).to.be.a('function');

            expect(validator.checkRequiredBoolean).to.be.a('function');
            expect(validator.checkOptionalBoolean).to.be.a('function');

            expect(validator.checkRequiredObject).to.be.a('function');
            expect(validator.checkOptionalObject).to.be.a('function');

            expect(validator.checkRequiredArray).to.be.a('function');
            expect(validator.checkOptionalArray).to.be.a('function');
        });
    });

    describe('checkRequiredString()', () => {
        const EXPECTED_TYPES = _testValues.allButString().map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkRequiredString(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = _testValues.getString('property');
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredString(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid string on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getString('property');
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredString(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getString('property');
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), '', {}];

            const tester = _sinon.spy();
            const promise = validator.checkRequiredString(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkOptionalString()', () => {
        const EXPECTED_TYPES = _testValues
            .allButSelected('undefined', 'string')
            .map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkOptionalString(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = _testValues.getString('property');
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalString(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid string on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getString('property');
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalString(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getString('property');
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), '', {}];

            const tester = _sinon.spy();
            const promise = validator.checkOptionalString(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkRequiredNumber()', () => {
        const EXPECTED_TYPES = _testValues.allButNumber().map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkRequiredNumber(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = _testValues.getNumber();
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredNumber(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid number on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getNumber();
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredNumber(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getNumber();
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), -1, -5];

            const tester = _sinon.spy();
            const promise = validator.checkRequiredNumber(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkOptionalNumber()', () => {
        const EXPECTED_TYPES = _testValues
            .allButSelected('undefined', 'number')
            .map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkOptionalNumber(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = _testValues.getNumber();
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalNumber(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid number on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getNumber();
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalNumber(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = _testValues.getNumber();
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), -1, -5];

            const tester = _sinon.spy();
            const promise = validator.checkOptionalNumber(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkRequiredBoolean()', () => {
        const EXPECTED_TYPES = _testValues.allButBoolean().map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkRequiredBoolean(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = !!Math.floor(Math.random() * 2);
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredBoolean(
                fullProperty,
                tester
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid boolean on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = !!Math.floor(Math.random() * 2);
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredBoolean(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = !!Math.floor(Math.random() * 2);
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), null, 123];

            const tester = _sinon.spy();
            const promise = validator.checkRequiredBoolean(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkOptionalBoolean()', () => {
        const EXPECTED_TYPES = _testValues
            .allButSelected('undefined', 'boolean')
            .map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkOptionalBoolean(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = !!Math.floor(Math.random() * 2);
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalBoolean(
                fullProperty,
                tester
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid boolean on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = !!Math.floor(Math.random() * 2);
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalBoolean(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = !!Math.floor(Math.random() * 2);
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), null, 123];

            const tester = _sinon.spy();
            const promise = validator.checkOptionalBoolean(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkRequiredObject()', () => {
        const EXPECTED_TYPES = _testValues.allButObject().map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkRequiredObject(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = {};
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredObject(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid object on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = {};
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredObject(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = {};
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), new Array(), {}];

            const tester = _sinon.spy();
            const promise = validator.checkRequiredObject(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkOptionalObject()', () => {
        const EXPECTED_TYPES = _testValues
            .allButSelected('undefined', 'object')
            .map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkOptionalObject(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = {};
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalObject(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid object on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = {};
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalObject(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = {};
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), new Array(), {}];

            const tester = _sinon.spy();
            const promise = validator.checkOptionalObject(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkRequiredArray()', () => {
        const EXPECTED_TYPES = _testValues.allButArray().map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkRequiredArray(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = [];
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredArray(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid array on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = [];
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkRequiredArray(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = [];
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), new Array(), {}];

            const tester = _sinon.spy();
            const promise = validator.checkRequiredArray(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });

    describe('checkOptionalArray()', () => {
        const EXPECTED_TYPES = _testValues
            .allButSelected('undefined', 'array')
            .map(_getType);

        const _invoke = (validator, property, tester) => {
            return validator.checkOptionalArray(property, tester);
        };

        describe('[input validation]', _getInputTestSuite(_invoke));
        describe('[response behavior]', _getResponseTestSuite(_invoke));

        it('should invoke the handler with the lambda wrapper, error type and message', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = _testValues.getString('property');
            const fullProperty = `parent.${property}`;
            const value = [];
            initialWrapper.setEventProperty(fullProperty, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalArray(fullProperty, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    tester.args.forEach((args) => {
                        const [wrapper, errorType, pattern] = args;
                        const errorMessage = `Schema validation failed. Details: [foo ${property} bar]`;

                        expect(wrapper).to.be.an.instanceof(LambdaTestWrapper);
                        expect(wrapper).to.not.equal(initialWrapper);

                        expect(errorType).to.equal(SchemaError);

                        expect(pattern).to.be.an.instanceof(RegExp);
                        expect(errorMessage).to.match(pattern);
                    });
                })
                .then(done, done);
        });

        it('should change the property value to an invalid array on each invocation', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = [];
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const tester = _sinon.spy();
            const promise = validator.checkOptionalArray(property, tester);

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(EXPECTED_TYPES.length);
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                })
                .then(done, done);
        });

        it('should use the extra values specified as additional test cases', (done) => {
            const initialWrapper = _createLambdaTestWrapper();
            const property = `parent.${_testValues.getString('property')}`;
            const value = [];
            initialWrapper.setEventProperty(property, value);
            const validator = _createInputValidator(initialWrapper);

            const extras = [_testValues.getString('extra1'), new Array(), {}];

            const tester = _sinon.spy();
            const promise = validator.checkOptionalArray(
                property,
                tester,
                extras
            );

            expect(promise)
                .to.be.fulfilled.then(() => {
                    expect(tester.callCount).to.equal(
                        EXPECTED_TYPES.length + extras.length
                    );
                    const values = tester.args.map((args) => {
                        const [wrapper] = args;
                        return _dotProp.get(wrapper.event, property);
                    });

                    expect(values).to.not.contain(value);
                    const actualTypes = values.map(_getType);
                    expect(actualTypes).to.contain.members(EXPECTED_TYPES);
                    expect(values).to.contain.members(extras);
                })
                .then(done, done);
        });
    });
});
