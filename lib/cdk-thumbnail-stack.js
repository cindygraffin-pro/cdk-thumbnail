import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import path, {join} from 'path';
import {fileURLToPath} from 'url';
import { Bucket } from 'aws-cdk-lib/aws-s3'


const __filename = fileURLToPath(import.meta.url);

class CdkThumbnailStack extends Stack {

  constructor(scope, id, props) {
    super(scope, id, props);

    const handler = new Function(this, 'handler-function-resizeImg', {
      runtime: Runtime.PYTHON_3_8,
      timeout: Duration.seconds(20),
      handler: 'app.s3_thumbnail_generator',
      code: Code.fromAsset(join(path.dirname(__filename), '../lambdas')),
      environment: {
        REGION_NAME: 'eu-west-3',
        THUMBNAIL_SIZE: '128'
      }
    })

    const s3Bucket = new Bucket(this, 'photo-bucket', {
      // when we'll destroy that project, the s3 will be too
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    // permission to read and write in the bucket
    s3Bucket.grantReadWrite(handler)
  }
}

export { CdkThumbnailStack }
