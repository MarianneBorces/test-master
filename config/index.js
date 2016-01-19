'use strict';

let env = process.env;

module.exports = {
	'mongodb' : env.MONGO || 'mongodb://mongo/e2e'
};
