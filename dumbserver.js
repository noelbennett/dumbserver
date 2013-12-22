//
// Dependencies
//
var http = require('http');
var fs   = require('fs');


//
// Constants
//
var DATA_LOCATION     = 'data'; // both the url root and the location of data file
var DATA_LOCATION_LEN = DATA_LOCATION.length;
var DATA_FILE         = __dirname + '/' + DATA_LOCATION;
var PORT              = 80;


//
// Load store file
//
var store = {}; // deafult empty object
try {
    var json = fs.readFileSync(DATA_FILE);
    store = JSON.parse(json);
    console.log('Read store file');
} catch (e) { // lazy error handling
    console.log('Could not load store file.  Using empty array.');
}


//
// Flush to store file on exit
//
var flush = function()
{
    console.log('Caught deadly signal.');
    console.log('Flushing data to file [' + DATA_FILE + ']\n');
    fs.writeFileSync(DATA_FILE, JSON.stringify(store));
};

var handleInterrupt = function() { flush(); process.exit(); };

process.on('SIGINT',  handleInterrupt);
process.on('SIGTERM', handleInterrupt);
process.on('SIGHUP',  flush); // HUP flushes to file but keeps the server running


//
// If request URI is prefixed with the value of DATA_LOCATION, we treat incoming request as a REST request
// Otherwise we serve the file referenced by the URI
//
var serveFile = function(loc, req, resp)
{
    var fullPath = __dirname + '/' + loc;
    console.log('Trying to serve file at [' + fullPath + ']');

    if (req.method !== 'GET') { // read only!
        resp.writeHead(405);
        resp.write('Unsupported method\n');
        resp.end();
    } else if (fs.existsSync(fullPath)) {
        resp.writeHead(200);
        fs.createReadStream(fullPath).pipe(resp);
    } else {
        resp.writeHead(404);
        resp.write('Not Found\n');
        resp.end();
    }
};

var serveRestData = function(key, req, resp)
{
    console.log(req.method + ' request for key [' + key + ']');

    switch (req.method) {

        case 'GET':
            if (store.hasOwnProperty(key)) {
                resp.writeHead(200, { 'Content-Type' : 'application/json' });
                resp.write(JSON.stringify(store[key]) + '\n');
            } else {
                resp.writeHead(404);
                resp.write('Not Found\n');
            }
            resp.end();
            break;

        case 'PUT':
            var json = '';
            req.on('data', function(chunk) { json += chunk; });
            req.on('end', function() {
                try {
                    var data = JSON.parse(json);
                    store[key] = data;
                    resp.writeHead(204);
                } catch (e) {
                    resp.writeHead(400);
                    resp.write('Invalid JSON\n');
                }
                resp.end();
            });
            break;

        case 'DELETE':
            if (store.hasOwnProperty(key)) {
                delete store[key];
                resp.writeHead(204);
            } else {
                resp.writeHead(404);
            }
            resp.end();
            break;

        default:
            resp.writeHead(405);
            resp.write('Unsupported method\n');
            resp.end();
    }

};

//
// Listen for connections
//
http.createServer(function(req, resp) {

    console.log('Serving [' + req.url + ']');
    var uri = req.url.replace(/^\/+|\/+$/g, ''); // trim slashes

    if (uri.substr(0, DATA_LOCATION_LEN + 1) === DATA_LOCATION + '/') { // rest request
        serveRestData(uri.substr(DATA_LOCATION_LEN + 1), req, resp);
    } else { // try to serve the file
        if (uri === '') { uri = 'index.html'; }
        serveFile(uri, req, resp);
    }

}).listen(PORT);
