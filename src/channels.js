const { writeFile } = require('fs')
const { join } = require('path')

module.exports = () => ({

    channels: {},

    loadChannels: function () {
        try {
            this.channels = require(join(__dirname, '..', 'data', 'channels.json'))
        } catch (error) {
            this.channels = {}
        }
    },
    saveChannels: async function () {
        writeFile(
            join(__dirname, '..', 'data', 'channels.json'),
            JSON.stringify(this.channels), () => { }
        )
    },
    addChannel: function (ircChannelID, dcGroupID) {
        console.log(ircChannelID, dcGroupID);

        this.channels[ircChannelID] = dcGroupID
        this.saveChannels()
    },
    getIRCChannel: function (dcGroupID) {
        return Object.keys(this.channels).find(ircChannelID => this.channels[ircChannelID] === dcGroupID);
    },
    getDCGroup: function (ircChannelID) {
        return this.channels[ircChannelID]
    },
})
