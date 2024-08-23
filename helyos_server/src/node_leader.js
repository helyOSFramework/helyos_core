const { v4: uuidv4 } = require('uuid');
const { getInstance } = require('./services/in_mem_database/mem_database_service');

class SingletonLeader {
    static instance;

    constructor() {
        if (SingletonLeader.instance) {
            return SingletonLeader.instance;
        }

        this.NODE_ID = uuidv4();
        this.LEADER_KEY = 'leader';
        this.LEADER_TTL = 5000;
        this.amILeader = undefined;
        this.inputBecomingFollower = [];
        this.inputBecomingLeader = [];

        SingletonLeader.instance = this;
    }

    async tryToBecomeLeader(becomingLeader, becomingFollower) {
        const inMemDB = await getInstance();
        const redisClient = inMemDB.client;
        try {
            const result = await redisClient.set(this.LEADER_KEY, this.NODE_ID, {
                NX: true,
                PX: this.LEADER_TTL
            });
            if (result) {
                console.log(`Node ${this.NODE_ID} is the leader ${result}`);
                if (this.amILeader !== true) {
                    this.inputBecomingFollower = await becomingLeader(this.inputBecomingLeader);
                    this.amILeader = true;
                }
                this.renewLeadership(redisClient, becomingLeader, becomingFollower);
                return true;
            } else {
                if (this.amILeader === true || this.amILeader === undefined) {
                    this.inputBecomingLeader = await becomingFollower(this.inputBecomingFollower);
                    this.amILeader = false;
                }
                setTimeout(() => this.tryToBecomeLeader(becomingLeader, becomingFollower),
                    Math.random() * 1000 + this.LEADER_TTL / 2);
                return false;
            }
        } catch (error) {
            console.error('Error during leader election:', error);
            return false;
        }
    }

    async renewLeadership(redisClient, becomingLeader, becomingFollower) {
        setTimeout(async () => {
            try {
                const leaderId = await redisClient.get(this.LEADER_KEY);
                if (leaderId === this.NODE_ID) {
                    const result = await redisClient.set(this.LEADER_KEY, this.NODE_ID, {
                        NX: false,
                        PX: this.LEADER_TTL
                    });
                    this.renewLeadership(redisClient, becomingLeader, becomingFollower);
                } else {
                    console.log(`Node ${this.NODE_ID} lost leadership ${leaderId}`);
                    this.tryToBecomeLeader(becomingLeader, becomingFollower);
                }
            } catch (error) {
                console.error('Error during leadership renewal:', error);
            }
        }, this.LEADER_TTL / 2);
    }
}

module.exports = new SingletonLeader();