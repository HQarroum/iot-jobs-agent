# Tutorial

You will find below a tutorial featuring a list of different steps to be taken to create multiple things in your AWS IoT device registry and test the execution of a job across multiple devices.

1. First, create using the device agent a given amount of devices that you would like to simulate. To do so, the device agent provides a command allowing you to create things in the AWS IoT device registry which will be associated with a specific attribute `device_simulator` set to the value `true`.

> The below example demonstrates how to create **50** things on your account

```bash
node jobs-agent.js create --number 50
```

2. Next, you need to create a device group that will define the things to update when using the AWS IoT Jobs service. Create a dynamic group matching the below request and give a name to your group.

> The below example uses the AWS CLI to create a dynamic group associated with a Lucene request matching the thing(s) created by the IoT Jobs agent. **Make sure you have the Fleet Indexing feature of AWS IoT Core enabled on your account before you create a Dynamic Group**

```bash
aws iot create-dynamic-thing-group --thing-group-name 'DeviceAgentGroup' --query-string 'attributes.device_simulator:true'
```

3. Create a new *Custom Job* using the AWS IoT Console. Provide it with a name, select the `DeviceAgentGroup` we just created as the device source for the job and select an AWS managed job document (you can select the one you'd like).
Select **Snapshot** as the job type (although you can test with a continuous job later) and click **Next**. Customize the parameters of the deployment and create the job.

4. Click on the created job to verify that the 50 Things we created are being added to the job as a `QUEUED` state.

5. Run the below command to start the job execution across your 50 things.

```bash
node jobs-agent.js update --number 50
```

This command will start by retrieving the jobs associated with your 50 things from the AWS IoT Jobs  API. Once the output of the application displays that the job execution has started, you can refresh the Jobs console to verify that the selected devices are transitionning to the `IN_PROGRESS` state. After the update has started on all devices and random amount of time (between 20-40 seconds by device), the IoT Jobs agent will update the state of the job execution of each device to reflect whether the execution was successful or not.

6. Once every device has been updated, the job will be marked as *complete* since we created a job of type *snapshot*. At this point you can delete the job.

7. You can also delete the created things by entering the following command.

```bash
node jobs-agent.js delete --number 50
```
