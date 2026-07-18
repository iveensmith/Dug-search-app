-- CreateEnum
CREATE TYPE "NigerianState" AS ENUM ('ABIA', 'ADAMAWA', 'AKWA_IBOM', 'ANAMBRA', 'BAUCHI', 'BAYELSA', 'BENUE', 'BORNO', 'CROSS_RIVER', 'DELTA', 'EBONYI', 'EDO', 'EKITI', 'ENUGU', 'FCT_ABUJA', 'GOMBE', 'IMO', 'JIGAWA', 'KADUNA', 'KANO', 'KATSINA', 'KEBBI', 'KOGI', 'KWARA', 'LAGOS', 'NASARAWA', 'NIGER', 'OGUN', 'ONDO', 'OSUN', 'OYO', 'PLATEAU', 'RIVERS', 'SOKOTO', 'TARABA', 'YOBE', 'ZAMFARA');

-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "state" "NigerianState" NOT NULL DEFAULT 'AKWA_IBOM';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "state" "NigerianState";

-- CreateIndex
CREATE INDEX "Pharmacy_state_idx" ON "Pharmacy"("state");
