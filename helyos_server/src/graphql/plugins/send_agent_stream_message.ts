import { gql, makeExtendSchemaPlugin } from "postgraphile";
import agentCommunication from "../../modules/communication/agent_communication";

export default makeExtendSchemaPlugin(() => {
    return {
        typeDefs: gql`
            input SendAgentStreamMessageInput {
                clientMutationId: String
                agentId: Int!
                body: String!
                metadata: JSON
            }

            type SendAgentStreamMessagePayload {
                clientMutationId: String
                success: Boolean!
            }

            extend type Mutation {
                sendAgentStreamMessage(
                input: SendAgentStreamMessageInput!
                ): SendAgentStreamMessagePayload
            }
        `,
        resolvers: {
            Mutation: {
                sendAgentStreamMessage: async (_query, args, _context, _resolveInfo) => {
                    const { clientMutationId, agentId, body } = args.input;

                    await agentCommunication.sendStreamMsgToAgent(agentId, body);

                    return {
                        clientMutationId,
                        success: true,
                    };
                },
            },
        },
    };
});