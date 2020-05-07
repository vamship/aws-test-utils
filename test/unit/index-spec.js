'use strict';

const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _rewire = require('rewire');

const LambdaTestWrapper = require('../../src/lambda-test-wrapper');
const InputValidator = require('../../src/input-validator');
let _index = null;

describe('index', function () {
    beforeEach(() => {
        _index = _rewire('../../src/index');
    });

    it('should export the expected modules and classes', () => {
        expect(_index.LambdaTestWrapper).to.equal(LambdaTestWrapper);
        expect(_index.InputValidator).to.equal(InputValidator);
    });
});
