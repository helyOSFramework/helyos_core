const { v4: uuidv4 } = require('uuid');
const {getInstance} = require('./services/in_mem_database/mem_database_service');
const NODE_ID = uuidv4();
const LEADER_KEY = 'leader';
const LEADER_TTL = 5000; // miliseconds


let amILeader=undefined;
let inputBecomingFollower = [];
let inputBecomingLeader = [];

async function tryToBecomeLeader(becomingLeader, becomingFollower) {
    const inMemDB = await getInstance();
    const redisClient = inMemDB.client;
    try {
        const result = await redisClient.set(LEADER_KEY, NODE_ID, {
            NX: true,  // Set the key only if it does not already exist
            PX: LEADER_TTL  
          });
        if (result) {
            console.log(`Node ${NODE_ID} is the leader ${result}`);
            if (amILeader!==true ){
                inputBecomingFollower = await becomingLeader(inputBecomingLeader);
                amILeader = true;
            }
            renewLeadership(redisClient,becomingLeader, becomingFollower);
            return true;
        } else {
            if ( amILeader===true || amILeader===undefined ){
                inputBecomingLeader = await becomingFollower(inputBecomingFollower);
                amILeader = false;
            }
            // Wait for a backoff period before trying again
            setTimeout(()=> tryToBecomeLeader(becomingLeader, becomingFollower),
                         Math.random() * 1000 + LEADER_TTL / 2); 
            return false;
        }
    } catch (error) {
        console.error('Error during leader election:', error);
        return false;
    }
}

async function renewLeadership(redisClient,becomingLeader, becomingFollower) {
    setTimeout(async () => {
        try {
            const leaderId = await redisClient.get(LEADER_KEY);
            if (leaderId === NODE_ID) {
                // Renew the leadership
                const result = await redisClient.set(LEADER_KEY, NODE_ID, {
                    NX: false,  // Set the key only if it does not already exist
                    PX: 5000   // Set expiration time to 5000 milliseconds (5 seconds)
                  });
                renewLeadership(redisClient, becomingLeader, becomingFollower);
            } else {
                console.log(`Node ${NODE_ID} lost leadership ${leaderId}`);
                tryToBecomeLeader(becomingLeader, becomingFollower);
            }
        } catch (error) {
            console.error('Error during leadership renewal:', error);
        }
    }, LEADER_TTL / 2); // Attempt to renew at half the TTL
}



module.exports = {
    tryToBecomeLeader,
    renewLeadership,
    amILeader
    
}