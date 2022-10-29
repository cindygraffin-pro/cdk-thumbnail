import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import path, {join} from 'path';
import {fileURLToPath} from 'url';
import s3 from 'aws-cdk-lib/aws-s3'
import s3n from 'aws-cdk-lib/aws-s3-notifications'
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';


const __filename = fileURLToPath(import.meta.url);

class CdkThumbnailStack extends Stack {

  constructor(scope, id, props) {
    super(scope, id, props);

    const table = new Table(this, 'thumbnail-table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    })

    

    const handler = new Function(this, 'handler-function-resizeImg', {
      runtime: Runtime.PYTHON_3_8,
      timeout: Duration.seconds(20),
      handler: 'app.s3_thumbnail_generator',
      code: Code.fromAsset(join(path.dirname(__filename), '../lambdas')),
      layers: [
        LayerVersion.fromLayerVersionArn(
          this,
          'PIL',
          'arn:aws:lambda:eu-west-3:770693421928:layer:Klayers-p38-Pillow:4'
        )
      ],
      environment: {
        MY_TABLE: table.tableName,
        REGION_NAME: 'eu-west-3',
        THUMBNAIL_SIZE: '128'
      }
    })

    const handlerListThumbnails = new Function(this, 'handler-function-getImg', {
      runtime: Runtime.PYTHON_3_8,
      timeout: Duration.seconds(20),
      handler: 'app.s3_get_thumbnail_urls',
      code: Code.fromAsset(join(path.dirname(__filename), '../lambdas')),
      layers: [
        LayerVersion.fromLayerVersionArn(
          this,
          'PIL-2',
          'arn:aws:lambda:eu-west-3:770693421928:layer:Klayers-p38-Pillow:4'
        )
      ],
      environment: {
        MY_TABLE: table.tableName,
        REGION_NAME: 'eu-west-3',
        THUMBNAIL_SIZE: '128'
      }
    })

    const thumbsApi = new RestApi(this, 'thumbnails-api', {
      description: 'Thumbnails API'
    })

    const handlerApiIntegration = new LambdaIntegration(handlerListThumbnails, {
      requestTemplates: {
        'application/json': '{"statusCode": "200"}' 
      }
    });

    const mainPath = thumbsApi.root.addResource('images');
    mainPath.addMethod('GET', handlerApiIntegration)


    const s3Bucket = new s3.Bucket(this, 'photo-bucket', {
      // when we'll destroy that project, the s3 will be too
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    // permission to read and write in the bucket
    s3Bucket.grantReadWrite(handler)

    s3Bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED, 
      new s3n.LambdaDestination(handler)
    )

    // grant permissions for lambda to write and read
    table.grantReadWriteData(handler)
    table.grantReadData(handlerListThumbnails)

    // handler is allowed to these actions onto these resources
    handler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        // ! very permissive
        actions: ['s3:*'],
        resources: ['*'] // 's3:PutObject', 's3:GetObject' is less permissive 
      })
    )
  }
}

export { CdkThumbnailStack }
