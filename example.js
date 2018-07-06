const { AppServer } = require('./');
const appServer = new AppServer({
    // passed to the Cookies module
    cookies: {
        keys: [  // array of strings or a Keygrip thing
            'notasecret',
            '1234567890',
            'abcdefghij'
        ],
        secure: false,  // specify secure connection
        signed: true,   // store a separate cookie with a hash of the first
    },
    cookie: {
        name: 'APPSERVER',
        maxAge: 1000*60*60*24*10,  // 10 days (in ms)
        expires: 1000*60*60*24*10,  // 10 days (in ms)
        path: '/',
        domain: null,
        secure: false,  // only send over HTTPS
        httpOnly: true,  // only for HTTP transfer, not for JS tampering
        sameSite: false,  // [false, 'lax', 'strict'/true] same site cookie
        signed: true,
        overwrite: true  // overwrite any cookie of this name in line to be set
    }
});
const port = 3500;

appServer.use('preRouting', async (ctx) => {
    console.log('function1 - pre');
});
appServer.use('preRouting', async (ctx) => {
    console.log('function2 - pre');
});


appServer.route('/', (ctx) => {
    console.log(`route '/'`);
    ctx.send(200, 'landing page');
});
appServer.route('/home', (ctx) => {
    console.log(`route '/home'`);
    ctx.send(200, 'home page');
});


appServer.use('postRouting', async (ctx) => {
    console.log('function3 - post');
});

appServer.listen(port, () => {
    console.log('server is listening...');
});