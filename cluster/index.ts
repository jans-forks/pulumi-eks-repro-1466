import * as pulumi from "@pulumi/pulumi";
import { Cluster, EksClusterArgs } from "./cluster";

const config = new pulumi.Config();
const stack = pulumi.getStack();



// const network: EksClusterArgs["network"] = {
//   vpcId: vpc.id,
//   controlPlaneSubnetIds: vpc.privateSubnetIds,
//   nodeGroupSubnetIds: vpc.privateSubnetIds,
//   publicSubnetIds: vpc.publicSubnetIds,
// };

const network: EksClusterArgs["network"] = {
  vpcId: 'vpc-x',
  controlPlaneSubnetIds: [ 'subnet-x', 'subnet-x' ],
  nodeGroupSubnetIds: [ 'subnet-x' ],
  publicSubnetIds: [ 'subnet-x', 'subnet-x' ]
}



const cluster = new Cluster("services", {
  clusterName: "services",
  instanceType: "t3.xlarge",
  network,
  scalingConfig: {
    minSize: 2,
    maxSize: 2,
    desiredSize: 2,
  },
  version: "1.32",
});

exports.clusterName = cluster.clusterName;
exports.clusterApiEndpoint = cluster.clusterApiEndpoint;
exports.oidcIssuerArn = cluster.oidcIssuerArn;
exports.oidcIssuerUrl = cluster.oidcIssuerUrl;
exports.kubeconfig = cluster.cluster.kubeconfig;
exports.vpcId = network.vpcId;
