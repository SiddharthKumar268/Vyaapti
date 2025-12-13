const cassandra = require('cassandra-driver');
const path = require('path');

// DataStax Astra DB Connection
const client = new cassandra.Client({
    cloud: {
        secureConnectBundle: path.join(__dirname, '../secure-connect-vyaapti.zip')
    },
    credentials: {
        username: process.env.ASTRA_CLIENT_ID || 'grpXrlZBvKEgKIHnqqIFzhmK',
        password: process.env.ASTRA_CLIENT_SECRET || 'MCgvzCnQYFl+X+fR8WIDeZNzIoKox+8HBkNwRB8H26P8PcQAL3Xi0HJ-mXsEHE18-.133_UJxdvWTlF9l5d1UTZoXDvw4k-bYxbLxJ2Z7BDu3hO0tysaGJZP98UzM+m.'
    },
    keyspace: 'vyaapti'
});

module.exports = client;