'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _rewire = require('rewire');

const { testValues: _testValues } = require('@vamship/test-utils');
const { ArgError } = require('@vamship/error-types').args;

let LambdaTestWrapper = null;

describe('LambdaTestWrapper', () => {
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
    function _createLambdaTestWrapper(functionName, handler, event) {
        functionName = functionName || _testValues.getString('functionName');
        handler = handler || _sinon.spy();
        event = event || {};
        return new LambdaTestWrapper(functionName, handler, event);
    }

    function _tokenizeArn(wrapper) {
        const { invokedFunctionArn } = wrapper.context;
        return invokedFunctionArn.split(':');
    }

    function _generateObject() {
        return {
            foo: {
                abc: _testValues.getNumber(),
                bar: _testValues.getString('baz'),
                chaz: {
                    nothing: undefined,
                    another: {
                        level: 3,
                        empty: null,
                        preset: !!Math.floor(Math.random() * 2),
                        values: [
                            _testValues.getNumber(),
                            {
                                foo: _testValues.getString('nestedFoo'),
                            },
                        ],
                    },
                },
            },
        };
    }

    beforeEach(() => {
        LambdaTestWrapper = _rewire('../../src/lambda-test-wrapper');
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid function name', () => {
            const message = 'Invalid functionName (arg #1)';
            const inputs = _testValues.allButString('');

            inputs.forEach((functionName) => {
                const wrapper = () => {
                    return new LambdaTestWrapper(functionName);
                };
                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should throw an error if invoked without a valid handler', () => {
            const message = 'Invalid handler (arg #2)';
            const inputs = _testValues.allButFunction();

            inputs.forEach((handler) => {
                const wrapper = () => {
                    const functionName = _testValues.getString('functionName');
                    return new LambdaTestWrapper(functionName, handler);
                };
                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return an object with the expected properties and methods', () => {
            const functionName = _testValues.getString('functionName');
            const handler = _sinon.spy();
            const wrapper = new LambdaTestWrapper(functionName, handler);

            expect(wrapper).to.be.an('object');
            expect(wrapper.functionName).to.equal(functionName);
            expect(wrapper.handler).to.equal(handler);
            expect(wrapper.event).to.deep.equal({});

            const context = wrapper.context;
            expect(context).to.be.an('object');
            expect(context.getRemainingTimeInMillis).to.be.a('function');
            expect(context.callbackWaitsForEmptyEventLoop).to.be.true;
            expect(context.functionName).to.equal(functionName);
            const tokens = context.invokedFunctionArn.split(':');
            expect(tokens).to.have.length(8);
            expect(tokens[0]).to.equal('arn');
            expect(tokens[1]).to.equal('aws');
            expect(tokens[2]).to.equal('lambda');
            expect(tokens[5]).to.equal('function');
            expect(tokens[6]).to.equal(functionName);
            expect(tokens[7]).to.equal('$LATEST');

            expect(context.memoryLimitInMB).to.equal(128);
            expect(context.awsRequestId).to.be.a('string').and.not.to.be.empty;
            expect(context.logGroupName).to.equal(
                `/aws/lambda/${functionName}`
            );
            expect(context.logStreamName).to.be.a('string').and.not.to.be.empty;

            expect(wrapper.setEventProperty).to.be.a('function');
            expect(wrapper.setContextProperty).to.be.a('function');
            expect(wrapper.removeAlias).to.be.a('function');
            expect(wrapper.setAlias).to.be.a('function');
            expect(wrapper.setRegion).to.be.a('function');
            expect(wrapper.setAccountId).to.be.a('function');

            expect(wrapper.clone).to.be.a('function');
            expect(wrapper.invoke).to.be.a('function');
        });

        it('should use the input object to initialize the event if one was specified', () => {
            const functionName = _testValues.getString('functionName');
            const handler = _sinon.spy();
            const event = _generateObject();
            const wrapper = new LambdaTestWrapper(functionName, handler, event);

            expect(wrapper.event).to.deep.equal(event);
            expect(wrapper.event).to.not.equal(event);
        });
    });

    describe('setEventProperty()', () => {
        it('should throw an error if invoked without a valid property', () => {
            const message = 'Invalid property (arg #1)';
            const inputs = _testValues.allButString('');

            inputs.forEach((property) => {
                const wrapper = () => {
                    const testWrapper = _createLambdaTestWrapper();
                    return testWrapper.setEventProperty(property);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return a reference to the wrapper object', () => {
            const wrapper = _createLambdaTestWrapper();

            const ret = wrapper.setEventProperty('foo', 'bar');

            expect(ret).to.equal(wrapper);
        });

        it('should update the event object with the specified values', () => {
            const inputs = _testValues.allButSelected();

            inputs.forEach((value) => {
                const depth = Math.floor(Math.random() * 3) + 1;
                const tokens = [];
                for (let index = 0; index < depth; index++) {
                    tokens[index] = _testValues.getString(`prop_${index}`);
                }
                const property = tokens.join('.');

                const wrapper = _createLambdaTestWrapper();

                wrapper.setEventProperty(property, value);
                let target = wrapper.event;
                tokens.forEach((prop) => {
                    target = target[prop];
                });
                expect(target).to.equal(value);
            });
        });
    });

    describe('setContextProperty()', () => {
        it('should throw an error if invoked without a valid property', () => {
            const message = 'Invalid property (arg #1)';
            const inputs = _testValues.allButString('');

            inputs.forEach((property) => {
                const wrapper = () => {
                    const testWrapper = _createLambdaTestWrapper();
                    return testWrapper.setContextProperty(property);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return a reference to the wrapper object', () => {
            const wrapper = _createLambdaTestWrapper();

            const ret = wrapper.setContextProperty('foo', 'bar');

            expect(ret).to.equal(wrapper);
        });

        it('should update the context object with the specified values', () => {
            const inputs = _testValues.allButSelected();

            inputs.forEach((value) => {
                const depth = Math.floor(Math.random() * 3) + 1;
                const tokens = [];
                for (let index = 0; index < depth; index++) {
                    tokens[index] = _testValues.getString(`prop_${index}`);
                }
                const property = tokens.join('.');

                const wrapper = _createLambdaTestWrapper();

                wrapper.setContextProperty(property, value);
                let target = wrapper.context;
                tokens.forEach((prop) => {
                    target = target[prop];
                });
                expect(target).to.equal(value);
            });
        });
    });

    describe('removeAlias()', () => {
        it('should remove the alias from the arn if the input alias is undefined', () => {
            const wrapper = _createLambdaTestWrapper();

            const arnTokens = _tokenizeArn(wrapper);

            expect(arnTokens).to.have.length(8);
            expect(arnTokens[7]).to.equal('$LATEST');

            wrapper.removeAlias();

            expect(_tokenizeArn(wrapper)).to.have.length(7);
        });

        it('should make no changes if the arn does not define an alias at the start', () => {
            const wrapper = _createLambdaTestWrapper();
            const initialArn = _testValues.getString('initArn');

            wrapper.context.invokedFunctionArn = initialArn;
            wrapper.removeAlias();

            expect(wrapper.context.invokedFunctionArn).to.equal(initialArn);
        });
    });

    describe('setAlias()', () => {
        it('should throw an error if invoked without a valid alias', () => {
            const message = 'Invalid alias (arg #1)';
            const inputs = _testValues.allButString('');

            inputs.forEach((alias) => {
                const wrapper = () => {
                    const testWrapper = _createLambdaTestWrapper();
                    return testWrapper.setAlias(alias);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return a reference to the wrapper object', () => {
            const wrapper = _createLambdaTestWrapper();

            const ret = wrapper.setAlias('foo');

            expect(ret).to.equal(wrapper);
        });

        it('should update the arn alias to the specified value', () => {
            const wrapper = _createLambdaTestWrapper();
            const alias = _testValues.getString('alias');

            wrapper.setAlias(alias);

            const arnTokens = _tokenizeArn(wrapper);
            expect(arnTokens.length).to.be.at.least(8);
            expect(arnTokens[7]).to.equal(alias);
        });

        it('should add the alias token even if the arn is malformed at the start', () => {
            const wrapper = _createLambdaTestWrapper();
            const alias = _testValues.getString('alias');
            const initialArn = _testValues.getString('initArn');

            wrapper.context.invokedFunctionArn = initialArn;
            wrapper.setAlias(alias);

            const arnTokens = _tokenizeArn(wrapper);
            expect(arnTokens.length).to.be.at.least(8);
            expect(arnTokens[7]).to.equal(alias);
        });
    });

    describe('setRegion()', () => {
        it('should throw an error if invoked without a valid region', () => {
            const message = 'Invalid region (arg #1)';
            const inputs = _testValues.allButString('');

            inputs.forEach((region) => {
                const wrapper = () => {
                    const testWrapper = _createLambdaTestWrapper();
                    return testWrapper.setRegion(region);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return a reference to the wrapper object', () => {
            const wrapper = _createLambdaTestWrapper();

            const ret = wrapper.setRegion('foo');

            expect(ret).to.equal(wrapper);
        });

        it('should update the arn region to the specified value', () => {
            const wrapper = _createLambdaTestWrapper();
            const region = _testValues.getString('region');

            wrapper.setRegion(region);

            const arnTokens = _tokenizeArn(wrapper);
            expect(arnTokens.length).to.be.at.least(4);
            expect(arnTokens[3]).to.equal(region);
        });

        it('should add the region token even if the arn is malformed at the start', () => {
            const wrapper = _createLambdaTestWrapper();
            const region = _testValues.getString('region');
            const initialArn = _testValues.getString('initArn');

            wrapper.context.invokedFunctionArn = initialArn;
            wrapper.setRegion(region);

            const arnTokens = _tokenizeArn(wrapper);
            expect(arnTokens.length).to.be.at.least(4);
            expect(arnTokens[3]).to.equal(region);
        });
    });

    describe('setAccountId()', () => {
        it('should throw an error if invoked without a valid accountId', () => {
            const message = 'Invalid accountId (arg #1)';
            const inputs = _testValues.allButString('');

            inputs.forEach((accountId) => {
                const wrapper = () => {
                    const testWrapper = _createLambdaTestWrapper();
                    return testWrapper.setAccountId(accountId);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return a reference to the wrapper object', () => {
            const wrapper = _createLambdaTestWrapper();

            const ret = wrapper.setAccountId('foo');

            expect(ret).to.equal(wrapper);
        });

        it('should update the arn accountId to the specified value', () => {
            const wrapper = _createLambdaTestWrapper();
            const accountId = _testValues.getString('accountId');

            wrapper.setAccountId(accountId);

            const arnTokens = _tokenizeArn(wrapper);
            expect(arnTokens.length).to.be.at.least(5);
            expect(arnTokens[4]).to.equal(accountId);
        });

        it('should add the accountId token even if the arn is malformed at the start', () => {
            const wrapper = _createLambdaTestWrapper();
            const accountId = _testValues.getString('accountId');
            const initialArn = _testValues.getString('initArn');

            wrapper.context.invokedFunctionArn = initialArn;
            wrapper.setAccountId(accountId);

            const arnTokens = _tokenizeArn(wrapper);
            expect(arnTokens.length).to.be.at.least(5);
            expect(arnTokens[4]).to.equal(accountId);
        });
    });

    describe('clone()', () => {
        it('should return an instance of the LambdaTestWrapper class', () => {
            const wrapper = _createLambdaTestWrapper();
            const clone = wrapper.clone();

            expect(clone).to.be.an.instanceOf(LambdaTestWrapper);
        });

        it('should have identical name, handler, event and context properties', () => {
            const event = _generateObject();
            const wrapper = _createLambdaTestWrapper(null, null, event);
            const clone = wrapper.clone();

            expect(clone.functionName).to.equal(wrapper.functionName);
            expect(clone.handler).to.equal(wrapper.handler);

            expect(clone.event).to.deep.equal(wrapper.event);
            expect(clone.event).to.not.equal(wrapper.event);
        });
    });

    describe('invoke()', () => {
        it('should return a promise when invoked', () => {
            const wrapper = _createLambdaTestWrapper();

            const ret = wrapper.invoke();
            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should invoke the handler with the correct parameters', () => {
            const handler = _sinon.spy();
            const expectedAlias = _testValues.getString('alias');
            const wrapper = _createLambdaTestWrapper(undefined, handler);

            wrapper.setAlias(expectedAlias);

            expect(handler).to.not.have.been.called;
            wrapper.invoke();

            expect(handler).to.have.been.calledOnce;
            const [event, context, ext] = wrapper.handler.args[0];
            expect(event).to.equal(wrapper.event);
            expect(context).to.equal(wrapper.context);

            expect(ext).to.be.an('object');

            const { logger, alias } = ext;
            expect(logger).to.be.an('object');
            LOG_METHODS.forEach((method) => {
                expect(logger[method]).to.be.a('function');
            });

            expect(alias).to.equal(expectedAlias);
        });

        it('should set a default value for the alias if an alias is not defined', () => {
            const handler = _sinon.spy();
            const wrapper = _createLambdaTestWrapper(undefined, handler);

            wrapper.removeAlias();

            expect(handler).to.not.have.been.called;
            wrapper.invoke();

            expect(handler).to.have.been.calledOnce;
            const ext = wrapper.handler.args[0][2];
            const { alias } = ext;
            expect(alias).to.equal('default');
        });

        it('should set a default value for the alias if the alias is set to $LATEST', () => {
            const handler = _sinon.spy();
            const wrapper = _createLambdaTestWrapper(undefined, handler);

            wrapper.setAlias('$LATEST');

            expect(handler).to.not.have.been.called;
            wrapper.invoke();

            expect(handler).to.have.been.calledOnce;
            const ext = wrapper.handler.args[0][2];
            const { alias } = ext;
            expect(alias).to.equal('default');
        });

        it('should reject the promise if the handler throws an error', (done) => {
            const error = new Error('something went wrong!');
            const handler = _sinon.stub().throws(error);
            const wrapper = _createLambdaTestWrapper(undefined, handler);

            const promise = wrapper.invoke();

            expect(promise).to.be.rejectedWith(error).and.notify(done);
        });

        it('should resolve the promise if the handler completes successfully', (done) => {
            const data = _generateObject();
            const handler = _sinon.stub().returns(data);
            const wrapper = _createLambdaTestWrapper(undefined, handler);

            const promise = wrapper.invoke();

            expect(promise)
                .to.be.fulfilled.then((result) => {
                    expect(result).to.equal(data);
                })
                .then(done, done);
        });

        it('should reject the promise if the handler returns a rejected promise', (done) => {
            const error = new Error('something went wrong!');
            const handler = _sinon.stub().rejects(error);
            const wrapper = _createLambdaTestWrapper(undefined, handler);

            const promise = wrapper.invoke();

            expect(promise).to.be.rejectedWith(error).and.notify(done);
        });

        it('should resolve the promise if the handler returs a resolved promise', (done) => {
            const data = _generateObject();
            const handler = _sinon.stub().resolves(data);
            const wrapper = _createLambdaTestWrapper(undefined, handler);

            const promise = wrapper.invoke();

            expect(promise)
                .to.be.fulfilled.then((result) => {
                    expect(result).to.equal(data);
                })
                .then(done, done);
        });
    });
});
