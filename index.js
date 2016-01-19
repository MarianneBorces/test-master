'use strict';

const _        = require( 'lodash' );
const fs       = require( 'fs' );
const Hapi     = require( 'hapi' );
const SocketIO = require( 'socket.io' );
const server   = new Hapi.Server();
const mongoose = require( 'mongoose' );
const config   = require( './config' );

const protractorConfig = require( 'protractor-config' );

mongoose.connect( config.mongodb );
require( './models/Tests' );
require( './models/Slaves' );

// load models first before master
const master = require( './master' );

setInterval( function(){
	console.log( 'Memory usage before clean up' );
	console.log( process.memoryUsage() );
  global.gc();
	console.log( 'Memory usage after clean up' );
	console.log( process.memoryUsage() );
  console.log( 'GC done' );
}, 1000 * 30 );

// Start the master to listen
master.on( 'listening', ( masterServer ) => {} );
master.on( 'error', ( error ) => {
	console.log( error );
} );

server.connection( {
	'port' : 3400,
	'labels' : 'rest',
	'routes' : {
		'cors' : {
			'origin' : [ '*' ]
		}
	}
} );

server.connection( {
	'port' : 3401,
	'labels' : 'ws'
} );

server.connection( {
	'port' : 3402,
	'labels' : 'static'
} );

const rest        = server.select( 'rest' );
const ws          = server.select( 'ws' );
const staticFiles = server.select( 'static' );

// Rest API
rest.route( require( './routes' )( master ) );

const io      = SocketIO.listen( ws.listener );
const logPath = process.cwd() + '/testlogs';

function getMachines ( slaves ) {
	let machines = [];

	_.forEach( slaves, function ( slave, key ) {
		_.forEach( slave, function ( machine, machineKey ) {
			let m = {
				'id'       : machine.id,
				'platform' : machine.platform,
				'name'     : machine.name
			};
			machines.push( m );
		} );
	} );

	return machines;
}

function createWriteStream( session, machineId ) {
	let writeStream = fs.createWriteStream( logPath + '/' + session + '.log', { 'flags' : 'w' } );
	writeStream.on( 'error', function ( error ) {
		// error
	} );
	return writeStream;
}

function slaveStream( socket, data ) {
	console.log( socket );
	socket.writeStream.write( data.data[ 0 ] );
	_.forEach( io.sockets.connected, ( socketEach, socketId ) => {
		socketEach.emit( 'browserstack-data-stream', {
			'machineId' : socket.name,
			'data'      : data.data[ 0 ]
		} );
	} );
};

// FIREHOSE
master.on( 'data', function ( data ) {
	_.forEach( io.sockets.connected, ( socket, socketId ) => {
		socket.emit( 'data-stream', data );
	} );
} );

// When there are new or removed slaves
master.on( 'update-slaves-list', function ( slaves ) {
	_.forEach( io.sockets.connected, ( socket, socketId ) => {
		let machines = getMachines( slaves );
		socket.emit( 'update-slaves-list', machines );
	} );
} );

io.sockets.on( 'connection', ( socket ) => {

	// Initially send for available machines
	socket.on( 'update-slaves-list', () => {
		let machines = getMachines( master.slaves );
		socket.emit( 'update-slaves-list', machines );
	} );

	socket.on( 'end-socket', () => {
		socket.writeStream.end();
	} );

	socket.on( 'register-browserstack', ( data ) => {
		socket.join( 'browserstack-slave' );
		var browserstack = data.browserstack;
		socket.name      = browserstack.automation_session.name
		socket.session   = browserstack.automation_session.session;

		// create write stream
		socket.writeStream = createWriteStream( socket.session );
	} );
	// Check what happened here
	socket.on( 'browserstack-stream', ( data ) => {
		slaveStream( socket, data );
	} );

} );

server.register( require( 'inert' ), ( error ) => {

	staticFiles.route( {
		'method' : 'GET',
		'path' : '/{param*}',
		'handler' : {
			'directory' : {
				'path' : 'public'
			}
		}
	} );

	server.start( ( error ) => {
		console.log( 'started' );
	} );

} );
