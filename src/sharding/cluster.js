const Eris = require("eris");
const Base = require("../structures/Base.js");
const utils = require("util");
const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms)); }
/**
 * 
 * 
 * @class Cluster
 */
class Cluster {

    /**
     * Creates an instance of Cluster.
     * @param {any} clusterID 
     * @memberof Cluster
     */
    constructor() {

        this.shards = 0;
        this.firstShardID = null;
        this.lastShardID = null;
        this.mainFile = null;
        this.clusterID = null;
        this.clusterCount = null;
        this.guilds = 0;
        this.users = 0;
        this.uptime = 0;
        this.voiceChannels = 0;
        this.app = null;
        this.bot = null;
        this.test = false;
	this.ram = 0;
        this.cpu = 0;
        this.latency = 0;

        console.log = (str) => process.send({ name: "log", msg: str });
        console.error = (str) => process.send({ name: "error", msg: str });
        console.warn = (str) => process.send({ name: "warn", msg: str });
        console.info = (str) => process.send({ name: "info", msg: str });
        console.debug = (str) => process.send({ name: "debug", msg: str });

    }

    spawn() {
        process.on('uncaughtException', (err) => {
            process.send({ name: "error", msg: err.stack });
        });

        process.on('unhandledRejection', (reason, p) => {
            process.send({ name: "error", msg: `Unhandled rejection at: Promise  ${p} reason:  ${reason.stack}` });
        });


        process.on("message", msg => {
            if (msg.name) {
                switch (msg.name) {
                    case "shards":
                        if (msg.type && msg.type === "round-robin") {
                            this.shards = this.shards + msg.shards;
                            process.send({ type: "log", msg: `Added ${msg.shards} more shards` });
                        } else if (msg.type && msg.type === "reboot") {
                            this.shards = msg.shards;
                            this.firstShardID = msg.firstShardID;
                            this.lastShardID = msg.lastShardID;
                            this.mainFile = msg.file;
                            this.clusterID = msg.id;
                            this.clusterCount = msg.clusterCount;
                            if (this.shards < 1) return;
                            if (msg.test) {
                                this.test = true;
                            }
                            this.connect(msg.firstShardID, msg.lastShardID, msg.maxShards, msg.token, "reboot", msg.clientOptions);
                        }
                        break;
                    case "connect":
                        this.firstShardID = msg.firstShardID;
                        this.lastShardID = msg.lastShardID;
                        this.mainFile = msg.file;
                        this.clusterID = msg.id;
                        this.clusterCount = msg.clusterCount;
                        if (this.shards < 1) return;
                        if (msg.test) {
                            this.test = true;
                        }
                        this.connect(msg.firstShardID, msg.lastShardID, msg.maxShards, msg.token, "connect", msg.clientOptions);
                        break;
                    case "stats":
                        process.send({
                            name: "stats", stats: {
                                guilds: this.guilds,
                                users: this.users,
                                uptime: this.uptime,
                                ram: process.memoryUsage().rss,
                                shards: this.shards,
                                voiceConnections: this.voiceChannels,
				cpu: this.cpu,
				latency: this.latency
                            }
                        });
                        break;
                    case "fetchUser":
                        let id = msg.value;
                        let user = this.bot.users.get(id);
                        if (user) {
                            process.send({ name: "fetchReturn", value: user });
                        }
                        break;
                    case "fetchChannel":
                        let id2 = msg.value;
                        let channel = this.bot.getChannel(id2);
                        if (channel) {
                            channel = channel.toJSON();
                            return process.send({ name: "fetchReturn", value: channel });
                        }
                        break;
                    case "fetchGuild":
                        let id3 = msg.value;
                        let guild = this.bot.guilds.get(id3);
                        if (guild) {
                            guild = guild.toJSON();
                            process.send({ name: "fetchReturn", value: guild });
                        }
                        break;
                    case "fetchReturn":
                        this.ipc.emit(msg.id, msg.value);
                        break;
                    case "restart":
                        process.exit(1);
                        break;
					case "eval":
						console.log('DASHBOARD EVALING: '+msg.value);
						eval(msg.value)
						break;
                }
            }
        });
    }

    /**
     * 
     * 
     * @param {any} firstShardID 
     * @param {any} lastShardID 
     * @param {any} maxShards 
     * @param {any} token 
     * @param {any} type 
     * @memberof Cluster
     */
    connect(firstShardID, lastShardID, maxShards, token, type, clientOptions) {
        switch (type) {
            case "connect":
                process.send({ name: "log", msg: `Connecting with ${this.shards} shards` });
                break;
            case "reboot":
                process.send({ name: "log", msg: `Rebooting with ${this.shards} shards` });
                break;
        }


        let options = { autoreconnect: true, firstShardID: firstShardID, lastShardID: lastShardID, maxShards: maxShards };
        let optionss = Object.keys(options);
        optionss.forEach(key => {
            delete clientOptions[key];
        });
        delete clientOptions.restMode;
        Object.assign(options, clientOptions);
        const bot = new Eris(token, options);
        this.bot = bot;
        bot.on("connect", id => {
            process.send({ name: "log", msg: `Shard ${id} established connection!` });
        });

        bot.on("shardDisconnect", (err, id) => {
            process.send({ name: "log", msg: `Shard ${id} disconnected!` });
            let embed = {
                title: "Shard Status Update",
                description: `Shard ${id} disconnected!`
            }
            process.send({ name: "shard", embed: embed });
        });

        bot.on("shardReady", id => {
            process.send({ name: "log", msg: `Shard ${id} is ready!` });
            let embed = {
                title: "Shard Status Update",
                description: `Shard ${id} is ready!`
            }
            process.send({ name: "shard", embed: embed });
        });

        bot.on("shardResume", id => {
            process.send({ name: "log", msg: `Shard ${id} has resumed!` });
            let embed = {
                title: "Shard Status Update",
                description: `Shard ${id} resumed!`
            }
            process.send({ name: "shard", embed: embed });
        });

        bot.on("warn", (message, id) => {
            process.send({ name: "warn", msg: `Shard ${id} | ${message}` });
        });

        bot.on("error", (error, id) => {
            process.send({ name: "error", msg: `Shard ${id} | ${error.stack}` });
        });

        bot.once("ready", id => {
            this.loadCode(bot);

            this.startStats(bot);
        });

        bot.on("ready", id => {
            process.send({ name: "log", msg: `Shards ${this.firstShardID} - ${this.lastShardID} are ready!` });
            let embed = {
                title: `Cluster ${this.clusterID} is ready!`,
                description: `Shards ${this.firstShardID} - ${this.lastShardID}`
            }
            process.send({ name: "cluster", embed: embed });

            process.send({ name: "shardsStarted" });
        });

        if (!this.test) {
            bot.connect();
        } else {
            process.send({ name: "shardsStarted" });
            this.loadCode(bot);
        }
    }
    
    loadCode(bot) {
        let rootPath = process.cwd();
        rootPath = rootPath.replace(`\\`, "/");


        let path = `${rootPath}${this.mainFile}`;
        let app = require(path);
        if (app.prototype instanceof Base) {
            this.app = new app({ bot: bot, clusterID: this.clusterID });
            this.app.launch();
            this.ipc = this.app.ipc;
        } else {
            console.error("Your code has not been loaded! This is due to it not extending the Base class. Please extend the Base class!");
        }
    }

    startStats(bot) {
        setInterval(async() => {
            this.guilds = bot.guilds.size;
            this.users = bot.users.size;
            this.uptime = bot.uptime;
            this.voiceChannels = bot.voiceConnections.size;
		this.latency = bot.shards.map(s => s.latency).reduce((a, b) => a+b) / bot.shards.size;
            let before = process.cpuUsage();
            await sleep(5000);
            let after = process.cpuUsage(before);
            this.cpu = Math.round( ((((after.user+after.system)/1000)/5000)*100)* 10 ) / 10;
        }, 1000 * 10);
    }
}


module.exports = Cluster;
