const { v4: uuidv4 } = require('uuid');
const InMemDBService = require('./services/in_mem_database/mem_database_service');
const redisAccessLayer = require('./services/in_mem_database/redis_access_layer');


const ROLES = {
    LEADER: 'leader',
    BROADCASTER: 'broadcaster',
    WORKER: 'worker'
}

/**
 * RoleAssigner is a singleton class responsible for managing leadership and broadcaster roles
 * within a distributed system using an in-memory database (Redis). 
 * There will be only one leader, only one brodcaster and N followers (workers).
 * 
 * @class
 */
class RoleAssigner {
    static instance;
    /**
     * The current role of the node. Can be 'worker', 'leader', or 'broadcaster'.
     * @type {string}
     */
    role = ROLES.WORKER; 

    constructor(redisClient) {
        if (RoleAssigner.instance) {
            return RoleAssigner.instance;
        }

        this.NODE_ID = uuidv4();
        this.LEADER_KEY = 'leader';
        this.BROADCASTER_KEY = 'broadcaster';
        this.KEY_TTL = 5000;
        this.redisClient = redisClient;
        this.amILeader = undefined;
        this.inputBecomingFollower = [];
        this.inputBecomingLeader = [];

        RoleAssigner.instance = this;
    }

    /**
     * Attempts to promote the current node to a broadcaster.
     * If successful, renews broadcastership periodically. Otherwise, retries after a delay.
     * 
     * @param {Function} becomingBroadcaster - Callback when becoming broadcaster.
     * @param {Function} becomingFollower - Callback when becoming a simple worker.
     * @returns {Promise<boolean>} - Returns true if the node becomes broadcaster, else false.
     */
    async tryToBecomeLeader(becomingLeader, becomingFollower) {
        try {

            const result = this.role === ROLES.WORKER ?  await this.redisClient.set(this.LEADER_KEY, this.NODE_ID, {
                                                                NX: true,
                                                                PX: this.KEY_TTL
                                                            }) : null;

            if (result) {
                console.log(`Node ${this.NODE_ID} is the leader ${result}`);
                if (this.amILeader !== true) {
                    this.inputBecomingFollower = await becomingLeader(this.inputBecomingLeader);
                    this.amILeader = true;
                    this.role = 'leader';
                }
                this._renewLeadership(this.redisClient, becomingLeader, becomingFollower);
                return true;
            } else {
                if (this.amILeader === true || this.amILeader === undefined) {
                    this.inputBecomingLeader = await becomingFollower(this.inputBecomingFollower);
                    this.amILeader = false;
                    this.role = ROLES.WORKER;

                }
                setTimeout(() => this.tryToBecomeLeader(becomingLeader, becomingFollower),
                    Math.random() * 1000 + this.KEY_TTL / 2);
                return false;
            }
        } catch (error) {
            console.error('Error during leader election:', error);
            return false;
        }
    }

    async _renewLeadership(redisClient, becomingLeader, becomingFollower) {
        setTimeout(async () => {
            try {
                const leaderId = await redisClient.get(this.LEADER_KEY);
                if (leaderId === this.NODE_ID) {
                    const result = await redisClient.set(this.LEADER_KEY, this.NODE_ID, {
                        NX: false,
                        PX: this.KEY_TTL
                    });
                    this._renewLeadership(redisClient, becomingLeader, becomingFollower);
                } else {
                    console.log(`Node ${this.NODE_ID} lost leadership to ${leaderId}`);
                    this.tryToBecomeLeader(becomingLeader, becomingFollower);
                }
            } catch (error) {
                console.error('Error during leadership renewal:', error);
            }
        }, this.KEY_TTL / 2);
    }


     /**
     * Renews the broadcaster role of the current node by refreshing the broadcaster key in Redis.
     * Continues to renew as long as the node remains the broadcaster.
     * 
     * @param {object} redisClient - The Redis client instance.
     * @param {Function} becomingBroadcaster - Callback when maintaining broadcastership.
     * @param {Function} becomingFollower - Callback when losing broadcastership.
     */
    async tryToBecomeBroadcaster(becomingBroadcaster, losingBroadcastership) {
        try {
            const result = this.role === ROLES.WORKER ?  await this.redisClient.set(this.BROADCASTER_KEY, this.NODE_ID, {
                                                            NX: true,
                                                            PX: this.KEY_TTL
                                                      }) : null;
            if (result) {
                console.log(`Node ${this.NODE_ID} is the broadcaster ${result}`);
                if (this.amILeader !== true) {
                    this.inputBecomingFollower = await losingBroadcastership(this.inputBecomingLeader);
                    this.amILeader = false;
                    this.role = 'broadcaster';

                }
                this._renewBroadcastership(this.redisClient, becomingBroadcaster, losingBroadcastership);
                return true;
            } else {
                if (this.role === 'broadcaster') {
                    this.inputBecomingLeader = await losingBroadcastership(this.inputBecomingFollower);
                    this.amILeader = false;
                    this.role = ROLES.WORKER;
                }
                setTimeout(() => this.tryToBecomeBroadcaster(becomingBroadcaster, losingBroadcastership),
                    Math.random() * 1000 + this.KEY_TTL / 2);
                return false;
            }
        } catch (error) {
            console.error('Error during broadcaseter election:', error);
            return false;
        }
    }

    async _renewBroadcastership(redisClient, becomingBroadcaster, losingBroadcastership) {
        setTimeout(async () => {
            try {
                const broadcasterId = await redisClient.get(this.BROADCASTER_KEY);
                if (broadcasterId === this.NODE_ID) {
                    const result = await redisClient.set(this.BROADCASTER_KEY, this.NODE_ID, {
                        NX: false,
                        PX: this.KEY_TTL
                    });
                    this._renewBroadcastership(redisClient, becomingBroadcaster, losingBroadcastership);
                } else {
                    console.log(`Node ${this.NODE_ID} lost broadcaster role to ${broadcasterId}`);
                    this.tryToBecomeBroadcaster(becomingBroadcaster, losingBroadcastership);
                }
            } catch (error) {
                console.error('Error during broadcaster renewal:', error);
            }
        }, this.KEY_TTL / 2);
    }



}


/**
 * Retrieves the RoleAssigner singleton instance.
 * 
 * @returns {RoleAssigner} - The singleton instance.
 */
let roleAssigner;
async function getInstance() {
  if (!roleAssigner) {
    console.log('====> Creating and initiating RolerAssigner Instance');
    try {
        const inMemDB = await InMemDBService.getInstance(); 
        roleAssigner = new RoleAssigner(inMemDB.client);
    } catch (error) {
        console.error('Failed to initialize RolerAssigner:', error);
        throw error; 
    }
  }
  return roleAssigner;
}

module.exports.getInstance = getInstance;