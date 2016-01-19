'use strict';

var mongoose = require( 'mongoose' );
var Schema = mongoose.Schema;

var SlaveModelSchema = new Schema( {
	'name'           : { 'type' : String, 'unique' : true },
	'os'             : String,
	'osVersion'      : String,
	'browser'        : String,
	'browserVersion' : String,
} );

mongoose.models.Slave = mongoose.model( 'Slave', SlaveModelSchema );
