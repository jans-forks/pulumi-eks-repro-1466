import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface EksClusterArgs {
  clusterName: string;
  instanceType: string;
  network: {
    publicSubnetIds: pulumi.Input<pulumi.Input<string>[]>;
    controlPlaneSubnetIds: pulumi.Input<pulumi.Input<string>[]>;
    nodeGroupSubnetIds: pulumi.Input<pulumi.Input<string>[]>;
    vpcId: pulumi.Input<string>;
  };
  scalingConfig?: aws.types.input.eks.NodeGroupScalingConfig;
  version: string;
  tags?: { [key: string]: string };
}

export class Cluster extends pulumi.ComponentResource {
  public readonly cluster: eks.Cluster;
  public readonly clusterName: pulumi.Output<string>;
  public readonly clusterApiEndpoint: pulumi.Output<string>;
  public readonly nodeGroupRole: aws.iam.Role;
  
  public readonly provider: k8s.Provider;
  public readonly oidcIssuerArn: pulumi.Output<string>;
  public readonly oidcIssuerUrl: pulumi.Output<string>;

  constructor(name: string, args: EksClusterArgs, opts?: pulumi.ResourceOptions) {
    super("myCluster", name, {}, opts);

    const { clusterName, instanceType, network, scalingConfig, version } = args;
    const parent = this;

    const nodeGroupRole = new aws.iam.Role(
      "nodegroup-role",
      {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "ec2.amazonaws.com",
        }),
        managedPolicyArns: [
          aws.iam.ManagedPolicy.AmazonEKSVPCResourceController,
          aws.iam.ManagedPolicy.AmazonEKSWorkerNodePolicy,
          aws.iam.ManagedPolicy.AmazonEC2ContainerRegistryReadOnly,
          aws.iam.ManagedPolicy.AmazonEKS_CNI_Policy,
          aws.iam.ManagedPolicy.AmazonSSMManagedInstanceCore,
          aws.iam.ManagedPolicy.AmazonEBSCSIDriverPolicy,
        ],
        name: "eks-nodegroup-role",
      },
      { parent }
    );

    const cluster = new eks.Cluster(
      "cluster",
      {

        authenticationMode: eks.AuthenticationMode.Api,  
        createOidcProvider: true,
        enabledClusterLogTypes: ["audit", "authenticator"],
        endpointPrivateAccess: true,
        endpointPublicAccess: true,
        instanceRole: nodeGroupRole,
        name: clusterName,
        privateSubnetIds: network.controlPlaneSubnetIds,
        // publicAccessCidrs: tailscaleExitNode,
        publicSubnetIds: network.publicSubnetIds,
        skipDefaultNodeGroup: true,
        version,
        vpcId: network.vpcId,
      },
      { parent }
    );



    const launchTemplate = new aws.ec2.LaunchTemplate(
      "node-group-launch-template",
      {
        blockDeviceMappings: [
          {
            deviceName: "/dev/xvda",
            ebs: {
              volumeSize: 20,
              volumeType: "gp2",
            },
          },
        ],
        ebsOptimized: "true",
        name: "node-group-launch-template",
        metadataOptions: {
          httpTokens: "required",
          httpPutResponseHopLimit: 2,
        },
        vpcSecurityGroupIds: [
          cluster.eksCluster.vpcConfig.clusterSecurityGroupId, // this SG should be on all node to talk with control plane
          cluster.nodeSecurityGroupId,
        ],
        tagSpecifications: [
          {
            resourceType: "instance",
            tags: {
              Name: `${clusterName}-node-group-x86`,
              ...(args.tags ?? {}),
            },
          },
          {
            resourceType: "volume",
            tags: {
              Name: `${clusterName}-node-group-x86`,
              ...(args.tags ?? {}),
            },
          },
          {
            resourceType: "network-interface",
            tags: {
              Name: `${clusterName}-node-group-x86`,
              ...(args.tags ?? {}),
            },
          },
          {
            resourceType: "spot-instances-request",
            tags: {
              Name: `${clusterName}-node-group-x86`,
              ...(args.tags ?? {}),
            },
          },
        ],
      },
      { parent }
    );


    new eks.ManagedNodeGroup(
      "node-group-x86",
      {
        amiType: "AL2023_x86_64_STANDARD",
        cluster,
        instanceTypes: [instanceType],
        launchTemplate: {
          id: launchTemplate.id,
          version: launchTemplate.latestVersion.apply((v) => v.toString()),
        },
        nodeGroupNamePrefix: clusterName,
        nodeRoleArn: nodeGroupRole.arn,
        scalingConfig: scalingConfig ?? {
          desiredSize: 1,
          maxSize: 1,
          minSize: 1,
        },
        subnetIds: network.nodeGroupSubnetIds,
        tags: {
          Name: `${clusterName}-node-group-x86`,
          ...(args.tags ?? {}),
        },
      },
      {
        dependsOn: [cluster],
        parent: cluster,
      }
    );

    
    this.cluster = cluster;
    this.clusterName = pulumi.output(clusterName);
    this.clusterApiEndpoint = cluster.core.endpoint;
    this.nodeGroupRole = nodeGroupRole;
    this.oidcIssuerArn = cluster.oidcProviderArn;
    this.oidcIssuerUrl = cluster.oidcProviderUrl;
    this.provider = cluster.provider;
  }
}
