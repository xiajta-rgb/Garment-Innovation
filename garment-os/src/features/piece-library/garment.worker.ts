import { runGarmentJob } from '@/application/garment-assembly-job';
import type { GarmentJob } from '@/application/garment-assembly-job';
self.onmessage=(event:MessageEvent<GarmentJob>)=>self.postMessage(runGarmentJob(event.data));
