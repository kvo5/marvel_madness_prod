-- AlterTable
ALTER TABLE `User` ADD COLUMN `lastDailyClaim` DATETIME(3) NULL,
    ADD COLUMN `lastHourlyClaim` DATETIME(3) NULL;
