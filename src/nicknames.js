const { writeFile } = require('fs')
const { join } = require('path')

module.exports = ()=>({
    nicknames: {},
    load: function () {
        try {
            this.nicknames = require(join(__dirname, '..', 'data', 'nicknames.json'))
        } catch (error) {
            this.nicknames = {}
        }
    },
    save: function () {
        writeFile(
            join(__dirname, '..', 'data', 'nicknames.json'),
            JSON.stringify(this.nicknames), () => { }
        )
    },
    setNick: function (email, nickname) {
        this.nicknames[email] = nickname
        this.save()
    },
    getNick: function (email) {
        return this.nicknames[email]
    },
    // Util
    email2Nick: function (address) {
        return this.getNick(address) || address.substring(0, address.indexOf("@"))
    }
})