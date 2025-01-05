import { v4 as uuidv4 } from 'uuid';
import * as InMemDBService from './services/in_mem_database/mem_database_service';

enum Roles {
    LEADER = 'leader',
    BROADCASTER = 'broadcaster',
    WORKER = 'worker',
}

/**
 * RoleAssigner is a singleton class responsible for managing leadership and broadcaster roles
 * within a distributed system using an in-memory database (Redis).
 * There will be only one leader, only one broadcaster, and N workers.
 */
class RoleAssigner {
    private static instance: RoleAssigner;

    public NODE_ID: string;
    public LEADER_KEY = 'leader';
    public BROADCASTER_KEY = 'broadcaster';
    public KEY_TTL = 5000; // Time-to-live for Redis keys in milliseconds
    private redisClient: any;

    role: Roles = Roles.WORKER;
    amILeader?: boolean;
    inputBecomingFollower: any[] = [];
    inputBecomingLeader: any[] = [];

    private constructor(redisClient: any) {
        this.NODE_ID = uuidv4();
        this.redisClient = redisClient;
    }

    static async getInstance(): Promise<RoleAssigner> {
        if (!RoleAssigner.instance) {
            console.log('====> Creating and initiating RoleAssigner instance');
            try {
                const inMemDB = await InMemDBService.getInstance();
                RoleAssigner.instance = new RoleAssigner(inMemDB.client);
            } catch (error) {
                console.error('Failed to initialize RoleAssigner:', error);
                throw error;
            }
        }
        return RoleAssigner.instance;
    }

    /**
     * Attempts to promote the current node to a leader.
     */
    async tryToBecomeLeader(
        becomingLeader: (input: any[]) => Promise<any[]>,
        becomingFollower: (input: any[]) => Promise<any[]>
    ): Promise<boolean> {
        try {
            const result =
                this.role === Roles.WORKER
                    ? await this.redisClient.set(this.LEADER_KEY, this.NODE_ID, {
                          NX: true,
                          PX: this.KEY_TTL,
                      })
                    : null;

            if (result) {
                console.log(`Node ${this.NODE_ID} is the leader ${result}`);
                if (!this.amILeader) {
                    this.inputBecomingFollower = await becomingLeader(this.inputBecomingLeader);
                    this.amILeader = true;
                    this.role = Roles.LEADER;
                }
                this._renewLeadership(becomingLeader, becomingFollower);
                return true;
            } else {
                if (this.amILeader || this.amILeader === undefined) {
                    this.inputBecomingLeader = await becomingFollower(this.inputBecomingFollower);
                    this.amILeader = false;
                    this.role = Roles.WORKER;
                }
                setTimeout(
                    () => this.tryToBecomeLeader(becomingLeader, becomingFollower),
                    Math.random() * 1000 + this.KEY_TTL / 2
                );
                return false;
            }
        } catch (error) {
            console.error('Error during leader election:', error);
            return false;
        }
    }

    private async _renewLeadership(
        becomingLeader: (input: any[]) => Promise<any[]>,
        becomingFollower: (input: any[]) => Promise<any[]>
    ) {
        setTimeout(async () => {
            try {
                const leaderId = await this.redisClient.get(this.LEADER_KEY);
                if (leaderId === this.NODE_ID) {
                    await this.redisClient.set(this.LEADER_KEY, this.NODE_ID, {
                        NX: false,
                        PX: this.KEY_TTL,
                    });
                    this._renewLeadership(becomingLeader, becomingFollower);
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
     * Attempts to promote the current node to a broadcaster.
     */
    async tryToBecomeBroadcaster(
        becomingBroadcaster: (input: any[]) => Promise<any[]>,
        losingBroadcastership: (input: any[]) => Promise<any[]>
    ): Promise<boolean> {
        try {
            const result =
                this.role === Roles.WORKER
                    ? await this.redisClient.set(this.BROADCASTER_KEY, this.NODE_ID, {
                          NX: true,
                          PX: this.KEY_TTL,
                      })
                    : null;

            if (result) {
                console.log(`Node ${this.NODE_ID} is the broadcaster ${result}`);
                if (this.role !== Roles.BROADCASTER) {
                    this.inputBecomingFollower = await losingBroadcastership(this.inputBecomingLeader);
                    this.amILeader = false;
                    this.role = Roles.BROADCASTER;
                }
                this._renewBroadcastership(becomingBroadcaster, losingBroadcastership);
                return true;
            } else {
                if (this.role === Roles.BROADCASTER) {
                    this.inputBecomingLeader = await losingBroadcastership(this.inputBecomingFollower);
                    this.amILeader = false;
                    this.role = Roles.WORKER;
                }
                setTimeout(
                    () => this.tryToBecomeBroadcaster(becomingBroadcaster, losingBroadcastership),
                    Math.random() * 1000 + this.KEY_TTL / 2
                );
                return false;
            }
        } catch (error) {
            console.error('Error during broadcaster election:', error);
            return false;
        }
    }

    private async _renewBroadcastership(
        becomingBroadcaster: (input: any[]) => Promise<any[]>,
        losingBroadcastership: (input: any[]) => Promise<any[]>
    ) {
        setTimeout(async () => {
            try {
                const broadcasterId = await this.redisClient.get(this.BROADCASTER_KEY);
                if (broadcasterId === this.NODE_ID) {
                    await this.redisClient.set(this.BROADCASTER_KEY, this.NODE_ID, {
                        NX: false,
                        PX: this.KEY_TTL,
                    });
                    this._renewBroadcastership(becomingBroadcaster, losingBroadcastership);
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

export { RoleAssigner, Roles };
export default RoleAssigner;
