const { spawn } = require('child_process')

async function uploadFile(path, cwd) {
    const args = [
        'upload',
        '--downloads', '50' //AUTH not implemented yet see https://gitlab.com/timvisee/ffsend/issues/58
        path
    ]

    return await new Promise((resolve, reject) => {
        try {
            var child = spawn('ffsend', args, {
                cwd,
                env: Object.assign({}, process.env, {
                    FFSEND_QUIET: 1,
                    FFSEND_INCOGNITO: 1,
                    FFSEND_NO_INTERACT: 1,
                    FFSEND_YES:1
                })
            })

            child.stdout.on('data', function (data) {
                console.log(data.toString())
            })
            child.stderr.on('data', function (data) {
                //throw errors
                console.error('stderr: ' + data)
                reject(new Error('FileUpload failed'))
            })

            child.on('close', function (code) {
                if (code !== 0) {
                    console.log(`ffsend process exited with code ${code}`);
                }
                child.stdin.end();
            })

            child.on('error', function (error) {
                reject(new Error)
            })
        } catch (error) {
            //console.error(error)
            reject(error)
        }
    })
}

function upload(filename){
    //upload
    // delete local file
    // send message with link to irc
}

uploadFile('nicknames.js', __dirname).then(console.log).catch(console.error)