import { GpuSpec } from '../types';

export const GPU_SPECS: GpuSpec[] = [
  {
    id: 'nvidia-h100-sxm5-80gb',
    name: 'NVIDIA H100 SXM5 (80GB)',
    vendor: 'NVIDIA',
    vramGB: 80,
    bandwidthGBs: 3350,
    tensorCores: '4th Gen (Hopper Transformer Engine)',
    awsInstance: 'p5.48xlarge (8x H100)',
    gcpInstance: 'a3-highgpu-8g (8x H100)',
    azureInstance: 'Standard_ND96isr_H100_v5',
    fp16Tflops: 989,
    hourlyPrice: {
      aws: { onDemand: 12.29, spot: 4.67, reserved1yr: 7.99 },
      gcp: { onDemand: 12.23, spot: 4.40, reserved1yr: 7.71 },
      azure: { onDemand: 12.40, spot: 4.85, reserved1yr: 8.06 }
    }
  },
  {
    id: 'nvidia-h200-141gb',
    name: 'NVIDIA H200 (141GB HBM3e)',
    vendor: 'NVIDIA',
    vramGB: 141,
    bandwidthGBs: 4800,
    tensorCores: '4th Gen (Hopper HBM3e)',
    awsInstance: 'p5e.48xlarge (8x H200)',
    gcpInstance: 'a3-ultragpu-8g (8x H200)',
    azureInstance: 'Standard_ND96is_H200_v5',
    fp16Tflops: 989,
    hourlyPrice: {
      aws: { onDemand: 14.50, spot: 5.80, reserved1yr: 9.40 },
      gcp: { onDemand: 14.25, spot: 5.70, reserved1yr: 9.26 },
      azure: { onDemand: 14.40, spot: 5.75, reserved1yr: 9.35 }
    }
  },
  {
    id: 'nvidia-a100-sxm4-80gb',
    name: 'NVIDIA A100 SXM4 (80GB)',
    vendor: 'NVIDIA',
    vramGB: 80,
    bandwidthGBs: 2039,
    tensorCores: '3rd Gen (Ampere)',
    awsInstance: 'p4de.24xlarge (8x A100 80G)',
    gcpInstance: 'a2-ultragpu-1g/2g/4g/8g',
    azureInstance: 'Standard_ND96amsr_A100_v4',
    fp16Tflops: 312,
    hourlyPrice: {
      aws: { onDemand: 5.12, spot: 1.95, reserved1yr: 3.33 },
      gcp: { onDemand: 4.95, spot: 1.73, reserved1yr: 3.12 },
      azure: { onDemand: 5.20, spot: 1.98, reserved1yr: 3.38 }
    }
  },
  {
    id: 'nvidia-a100-pcie-40gb',
    name: 'NVIDIA A100 PCIe (40GB)',
    vendor: 'NVIDIA',
    vramGB: 40,
    bandwidthGBs: 1555,
    tensorCores: '3rd Gen (Ampere)',
    awsInstance: 'p4d.24xlarge (8x A100 40G)',
    gcpInstance: 'a2-highgpu-1g/2g/4g',
    azureInstance: 'Standard_ND96asr_v4',
    fp16Tflops: 312,
    hourlyPrice: {
      aws: { onDemand: 4.10, spot: 1.50, reserved1yr: 2.67 },
      gcp: { onDemand: 3.67, spot: 1.28, reserved1yr: 2.31 },
      azure: { onDemand: 4.05, spot: 1.55, reserved1yr: 2.63 }
    }
  },
  {
    id: 'nvidia-l40s-48gb',
    name: 'NVIDIA L40S (48GB Ada Lovelace)',
    vendor: 'NVIDIA',
    vramGB: 48,
    bandwidthGBs: 864,
    tensorCores: '4th Gen (Ada Lovelace)',
    awsInstance: 'g6e.xlarge to g6e.48xlarge',
    gcpInstance: 'g2-standard-48 (with L40S)',
    azureInstance: 'Standard_NG48ads_V620_v1',
    fp16Tflops: 366,
    hourlyPrice: {
      aws: { onDemand: 2.14, spot: 0.85, reserved1yr: 1.39 },
      gcp: { onDemand: 2.25, spot: 0.90, reserved1yr: 1.46 },
      azure: { onDemand: 2.20, spot: 0.88, reserved1yr: 1.43 }
    }
  },
  {
    id: 'nvidia-l4-24gb',
    name: 'NVIDIA L4 (24GB Ada Lovelace)',
    vendor: 'NVIDIA',
    vramGB: 24,
    bandwidthGBs: 300,
    tensorCores: '4th Gen (Ada Lovelace, Efficient)',
    awsInstance: 'g6.xlarge to g6.12xlarge',
    gcpInstance: 'g2-standard-4 / g2-standard-8',
    azureInstance: 'Standard_NV28ads_A10_v5',
    fp16Tflops: 120,
    hourlyPrice: {
      aws: { onDemand: 0.80, spot: 0.29, reserved1yr: 0.52 },
      gcp: { onDemand: 0.70, spot: 0.25, reserved1yr: 0.45 },
      azure: { onDemand: 0.75, spot: 0.28, reserved1yr: 0.49 }
    }
  },
  {
    id: 'nvidia-a10g-24gb',
    name: 'NVIDIA A10G (24GB)',
    vendor: 'NVIDIA',
    vramGB: 24,
    bandwidthGBs: 600,
    tensorCores: '2nd Gen RT / 3rd Gen Tensor',
    awsInstance: 'g5.xlarge / g5.2xlarge / g5.12xlarge',
    gcpInstance: 'custom-n1-with-a10',
    azureInstance: 'Standard_NV36ads_A10_v5',
    fp16Tflops: 125,
    hourlyPrice: {
      aws: { onDemand: 1.01, spot: 0.39, reserved1yr: 0.65 },
      gcp: { onDemand: 1.08, spot: 0.41, reserved1yr: 0.70 },
      azure: { onDemand: 1.05, spot: 0.40, reserved1yr: 0.68 }
    }
  },
  {
    id: 'nvidia-t4-16gb',
    name: 'NVIDIA T4 (16GB)',
    vendor: 'NVIDIA',
    vramGB: 16,
    bandwidthGBs: 320,
    tensorCores: '2nd Gen (Turing)',
    awsInstance: 'g4dn.xlarge / g4dn.12xlarge',
    gcpInstance: 'n1-standard-4 (with 1x T4)',
    azureInstance: 'Standard_NC4as_T4_v3',
    fp16Tflops: 65,
    hourlyPrice: {
      aws: { onDemand: 0.53, spot: 0.16, reserved1yr: 0.34 },
      gcp: { onDemand: 0.48, spot: 0.15, reserved1yr: 0.31 },
      azure: { onDemand: 0.50, spot: 0.16, reserved1yr: 0.32 }
    }
  },
  {
    id: 'amd-mi300x-192gb',
    name: 'AMD Instinct MI300X (192GB CDNA3)',
    vendor: 'AMD',
    vramGB: 192,
    bandwidthGBs: 5300,
    tensorCores: 'CDNA 3 Matrix Cores',
    awsInstance: 'Upcoming ROCm Instances',
    gcpInstance: 'GCP Cloud TPU/AMD Preview',
    azureInstance: 'Standard_ND96isr_MI300X_v5',
    fp16Tflops: 1300,
    hourlyPrice: {
      aws: { onDemand: 8.50, spot: 3.40, reserved1yr: 5.50 },
      gcp: { onDemand: 8.25, spot: 3.30, reserved1yr: 5.35 },
      azure: { onDemand: 8.40, spot: 3.35, reserved1yr: 5.45 }
    }
  }
];
