const fs = require('fs-extra')
const path = require('path')
const uuidv1 = require('uuid/v1')

const dest = path.join(__dirname, '../temp')
const url = "https://ircbot.simonlaux.de" 

async function fileSave(filepath, filename) {
    const uuid = uuidv1()
    try {
        await fs.ensureDir(path.join(dest, uuid))
        await fs.move(filepath, path.join(dest, uuid, filename))
        resetCleanTimeout()
        return `${url}/${uuid}/${filename}`
    } catch (error) {
        console.error(error)
        return "[FileProvider: There happened an error uploading this file]"
    }
}

var timeout

const resetCleanTimeout = () => {
    if(timeout !== undefined)clearTimeout(timeout)
    timeout = setTimeout(()=>{
        fs.emptyDir(path.join(__dirname, '../data/db.sqlite-blobs'))
    }, 20000)
}

//TODO delete old files

module.exports = {
    fileSave
}