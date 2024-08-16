const { v4: uuidv4 } = require('uuid');
const {getInstance} = require('./services/in_mem_database/mem_database_service');
const NODE_ID = uuidv4();
const LEADER_KEY = 'leader';
const LEADER_TTL = 8000; // 6 seconds


let amILeader=false;
let inputBecomingFollwer;
let inputBecomingLeader;

async function tryToBecomeLeader(becomingLeader, becomingFollower) {
    console.log(becomingLeader,becomingFollower )
    const inMemDB = await getInstance();
    const redisClient = inMemDB.client;
    try {
        const result = await redisClient.set(LEADER_KEY, NODE_ID, {
            NX: true,  // Set the key only if it does not already exist
            PX: 5000   // Set expiration time to 5000 milliseconds (5 seconds)
          });
        if (result) {
            console.log(`Node ${NODE_ID} is the leader ${result}`);
            if (!amILeader){
                inputBecomingFollwer = await becomingLeader(inputBecomingLeader);
                amILeader = true;
            }
            renewLeadership(redisClient,becomingLeader, becomingFollower);
            return true;
        } else {
            console.log(`Node ${NODE_ID} is not the leader`);
            if (amILeader){
                inputBecomingLeader = await becomingFollower(inputBecomingFollwer);
                amILeader = false;
            }
            const leaderId = await redisClient.get(LEADER_KEY);
            console.log(`Current leader is ${leaderId}`);
            // Wait for a backoff period before trying again
            setTimeout(()=> tryToBecomeLeader(becomingLeader, becomingFollower),
                         Math.random() * 2000 + LEADER_TTL / 2); 
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
                console.log(`Node ${NODE_ID} renewed leadership`);
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