-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: evsu_igp_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `audit_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `action` varchar(50) NOT NULL,
  `table_name` varchar(50) NOT NULL,
  `record_id` int(11) NOT NULL,
  `action_timestamp` datetime NOT NULL DEFAULT current_timestamp(),
  `reason` text DEFAULT NULL,
  PRIMARY KEY (`audit_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'INSERT','users',2,'2026-05-27 10:00:00','Created staff account for Maria Santos'),(2,1,'INSERT','users',3,'2026-05-27 10:00:00','Created staff account for Juan Dela Cruz'),(3,2,'INSERT','sales',1,'2026-05-27 09:30:00',NULL),(4,3,'INSERT','sales',2,'2026-05-27 10:15:00',NULL),(5,2,'INSERT','sales',3,'2026-05-27 11:00:00',NULL),(6,3,'INSERT','sales',4,'2026-05-27 13:30:00',NULL),(7,2,'INSERT','sales',5,'2026-05-27 14:45:00',NULL),(8,1,'added','items',25,'2026-05-28 15:48:57','Added new item: Sample Item'),(9,1,'added','items',26,'2026-05-28 15:49:23','Added new item: Angelo Mahusay'),(10,1,'edited','items',1,'2026-05-29 04:06:21','Updated details for item: Female Uniform (Skirt) (ID: 1)'),(11,1,'deleted','items',31,'2026-05-29 04:16:04','Archived item: Jerseysa (ID: 31)'),(12,1,'deleted','sales',19,'2026-05-29 15:21:59','Sale voided by admin'),(13,1,'edited','sales',21,'2026-05-29 15:26:46','Updated sale quantity'),(14,1,'edited','sales',21,'2026-05-29 15:29:39','Added A sale'),(15,1,'edited','sales',21,'2026-05-29 15:36:31','deducted a sale'),(16,1,'edited','items',3,'2026-05-29 15:37:06','Updated details for item: Female Uniform (Skirt) (ID: 3)'),(17,1,'edited','sales',21,'2026-05-29 15:40:32','Okayy'),(18,1,'edited','sales',21,'2026-05-29 15:42:49','sag'),(19,1,'edited','sales',21,'2026-05-29 15:43:35','sag'),(20,1,'edited','sales',21,'2026-05-29 15:47:07','Try modal'),(21,1,'edited','sales',21,'2026-05-29 15:49:13','Mofication'),(22,1,'deleted','sales',20,'2026-05-29 15:52:50','Try delete'),(23,1,'edited','users',6,'2026-05-29 16:42:41','Updated user name'),(24,1,'deleted','users',3,'2026-05-29 16:42:51','Deactivated user account for juan.delacruz@evsu.edu.ph'),(25,1,'edited','users',6,'2026-05-29 16:46:13','Updated user role'),(26,1,'edited','users',6,'2026-05-29 16:50:00','Updated user role'),(27,1,'edited','items',2,'2026-05-30 03:44:17','Updated details for item: Female Uniform (Skirt) (ID: 2)'),(28,1,'edited','sales',22,'2026-05-30 04:42:27','No program');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `item_name` varchar(100) NOT NULL,
  `category` enum('Uniforms','PE Uniforms','Neckties','Accessories','Others') NOT NULL,
  `size` enum('N/A','XS','S','M','L','XL','2XL','3XL') NOT NULL DEFAULT 'N/A',
  `price` decimal(10,2) NOT NULL,
  `stock_quantity` int(11) NOT NULL DEFAULT 0,
  `low_stock_threshold` int(11) NOT NULL DEFAULT 10,
  `item_photo` varchar(255) DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

LOCK TABLES `items` WRITE;
/*!40000 ALTER TABLE `items` DISABLE KEYS */;
INSERT INTO `items` VALUES (1,'Female Uniform (Skirt)','Uniforms','M',630.00,17,10,NULL,0,'2026-05-27 10:00:00'),(2,'Female Uniform (Skirt)','PE Uniforms','L',680.00,19,10,'http://127.0.0.1:8000/static/uploads/products/dad0a4363ab648058bf4921e70fe0631_',0,'2026-05-27 10:00:00'),(3,'Female Uniform (Skirt)','Uniforms','XL',780.00,21,10,NULL,0,'2026-05-27 10:00:00'),(4,'Female Uniform (Pants)','Uniforms','M',650.00,19,10,NULL,0,'2026-05-27 10:00:00'),(5,'Female Uniform (Pants)','Uniforms','L',720.00,14,10,NULL,0,'2026-05-27 10:00:00'),(6,'Female Uniform (Pants)','Uniforms','XL',800.00,39,10,'http://127.0.0.1:8000/static/uploads/products/62597b9e48bd47c9adcb7350af0a5f84_',0,'2026-05-27 10:00:00'),(7,'Male Uniform (Polo + Pants)','Uniforms','M',680.00,25,10,NULL,0,'2026-05-27 10:00:00'),(8,'Male Uniform (Polo + Pants)','Uniforms','L',750.00,20,10,NULL,0,'2026-05-27 10:00:00'),(9,'Male Uniform (Polo + Pants)','Uniforms','XL',820.00,15,10,NULL,0,'2026-05-27 10:00:00'),(10,'PE Uniform','PE Uniforms','L',680.00,30,10,'http://127.0.0.1:8000/static/uploads/products/6dd83f6b05374318abf576da718cb62d_',0,'2026-05-27 10:00:00'),(11,'PE Uniform','PE Uniforms','XL',700.00,20,10,'http://127.0.0.1:8000/static/uploads/products/3ee4f7e60a2447c288c2bfa933d8349e_',0,'2026-05-27 10:00:00'),(12,'Blue Necktie','Neckties','N/A',170.00,11,5,NULL,0,'2026-05-27 10:00:00'),(13,'Red Necktie','Neckties','N/A',170.00,0,5,NULL,0,'2026-05-27 10:00:00'),(14,'Yellow Necktie','Neckties','N/A',170.00,15,5,NULL,0,'2026-05-27 10:00:00'),(15,'Patch','Accessories','N/A',100.00,50,10,NULL,0,'2026-05-27 10:00:00'),(16,'Uniform Pin','Accessories','N/A',120.00,35,10,NULL,0,'2026-05-27 10:00:00'),(17,'ID Sling','Accessories','N/A',110.00,24,10,NULL,0,'2026-05-27 10:00:00'),(18,'Test Booklet','Others','N/A',5.00,200,50,NULL,0,'2026-05-27 10:00:00'),(22,'Jersey','Uniforms','L',450.00,8,10,'http://127.0.0.1:8000/static/uploads/products/b967e2a516204adcb709eba649c66177_evsulogo.png',0,'2026-05-27 12:24:06'),(23,'Jersey','Uniforms','L',450.00,30,10,'http://127.0.0.1:8000/static/uploads/products/95391706bfd449ccb49bc4b859a18a40_BHW.jpg',1,'2026-05-27 12:49:43'),(24,'Sample Item','Uniforms','XS',450.00,11,10,'http://127.0.0.1:8000/static/uploads/products/e88473bf1f244e0286e752b1cfde08f6_',1,'2026-05-28 15:44:53'),(25,'Sample Item','Uniforms','S',450.00,50,10,'http://127.0.0.1:8000/static/uploads/products/af5493e0a0ec41f2a4fc6eb9c810c19e_',0,'2026-05-28 15:48:57'),(26,'Angelo Mahusay','Uniforms','XS',458.00,50,10,'http://127.0.0.1:8000/static/uploads/products/17069454149e4b7cbcf0297922f8ad50_evsulogo.png',0,'2026-05-28 15:49:23'),(27,'Michael Kent Sales','Uniforms','XS',458.00,50,10,'http://127.0.0.1:8000/static/uploads/products/89d737e604594058a9a7cc31054eb687_BHW.jpg',1,'2026-05-28 20:32:01'),(28,'Try adding','Uniforms','XL',450.00,10,10,'http://127.0.0.1:8000/static/uploads/products/8795977ae8cc44bebdc67152924c58b1_evsulogo.png',0,'2026-05-28 20:51:28'),(29,'Angelo Mahusay','Uniforms','XS',55.00,11,10,'http://127.0.0.1:8000/static/uploads/products/4a0608e9a9264dd1b8f9fb07434677f1_',0,'2026-05-28 20:58:39'),(30,'Sample Item','Uniforms','2XL',50.00,90,10,'http://127.0.0.1:8000/static/uploads/products/e73f57d1fb8445418164a3ead99aec06_BHW.jpg',0,'2026-05-28 21:03:25'),(31,'Jerseysa','PE Uniforms','XL',3131.00,30,10,'http://127.0.0.1:8000/static/uploads/products/3a195e832a6142a0a54852a3ed164d0a_Layer_1.png',1,'2026-05-28 21:11:29'),(32,'Jersey','PE Uniforms','XS',21.00,51,10,NULL,1,'2026-05-29 03:14:37');
/*!40000 ALTER TABLE `items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_items`
--

DROP TABLE IF EXISTS `sale_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sale_items` (
  `sale_item_id` int(11) NOT NULL AUTO_INCREMENT,
  `sale_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`sale_item_id`),
  KEY `sale_id` (`sale_id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`sale_id`),
  CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_items`
--

LOCK TABLES `sale_items` WRITE;
/*!40000 ALTER TABLE `sale_items` DISABLE KEYS */;
INSERT INTO `sale_items` VALUES (1,1,1,1,630.00,630.00),(2,1,12,1,170.00,170.00),(3,2,13,1,170.00,170.00),(4,3,10,1,680.00,680.00),(5,4,13,1,170.00,170.00),(6,5,1,1,630.00,630.00),(7,11,3,1,780.00,780.00),(8,11,2,1,680.00,680.00),(9,12,1,1,630.00,630.00),(10,13,17,1,110.00,110.00),(11,14,13,4,170.00,680.00),(12,15,12,1,170.00,170.00),(13,16,22,20,450.00,9000.00),(14,17,22,2,450.00,900.00),(15,17,3,2,780.00,1560.00),(16,17,5,1,720.00,720.00),(17,18,1,1,630.00,630.00),(18,18,2,1,680.00,680.00),(19,19,1,1,630.00,630.00),(20,20,3,1,780.00,780.00),(37,21,1,2,630.00,1260.00),(38,21,2,4,680.00,2720.00),(42,22,1,1,630.00,630.00),(43,22,4,1,650.00,650.00),(44,22,6,1,800.00,800.00),(45,23,1,1,630.00,630.00),(46,23,2,1,680.00,680.00);
/*!40000 ALTER TABLE `sale_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sales` (
  `sale_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `student_name` varchar(100) NOT NULL,
  `student_program` enum('BSIT','BSED','BSCE','BEED','BSBA') NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `sale_date` datetime NOT NULL DEFAULT current_timestamp(),
  `or_number` varchar(50) NOT NULL,
  `last_modified_by` int(11) DEFAULT NULL,
  `last_modified_at` datetime DEFAULT NULL,
  `modification_reason` text DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`sale_id`),
  UNIQUE KEY `or_number` (`or_number`),
  KEY `user_id` (`user_id`),
  KEY `last_modified_by` (`last_modified_by`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`last_modified_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
INSERT INTO `sales` VALUES (1,2,'Maria Santos','BSIT',800.00,'2026-05-27 09:30:00','2025-00123',NULL,NULL,NULL,0),(2,3,'John Cruz','BSED',170.00,'2026-05-27 10:15:00','2025-00124',NULL,NULL,NULL,0),(3,2,'Anna Reyes','BSCE',680.00,'2026-05-27 11:00:00','2025-00125',NULL,NULL,NULL,0),(4,3,'Peter Lim','BSCE',170.00,'2026-05-27 13:30:00','2025-00126',NULL,NULL,NULL,0),(5,2,'Rosa Lopez','BSED',630.00,'2026-05-27 14:45:00','2025-00127',NULL,NULL,NULL,0),(11,1,'Michael Kent Sales','BSIT',1460.00,'2026-05-28 12:52:32','OR-2151929151',NULL,NULL,NULL,0),(12,1,'Bok','BSCE',630.00,'2026-05-28 15:05:56','554221121',NULL,NULL,NULL,0),(13,1,'Michael Kent Sales','BSIT',110.00,'2026-05-28 15:53:28','5551221',NULL,NULL,NULL,0),(14,1,'Karl','BSCE',680.00,'2026-05-28 15:54:38','255663318',NULL,NULL,NULL,0),(15,1,'James','BSCE',170.00,'2026-05-28 19:30:51','551221231',NULL,NULL,NULL,0),(16,6,'Michael Kent Sales','BSED',9000.00,'2026-05-28 20:05:28','516611251',NULL,NULL,NULL,0),(17,6,'Michael Kent','BSIT',3180.00,'2026-05-28 20:06:19','662112351',NULL,NULL,NULL,0),(18,1,'qwrq','BSIT',1310.00,'2026-05-28 20:29:09','66127737',NULL,NULL,NULL,0),(19,1,'Trynsaction','BSIT',630.00,'2026-05-28 20:40:53','6216121',NULL,NULL,NULL,1),(20,1,'sasga','BSCE',780.00,'2026-05-29 04:45:51','66666666',NULL,NULL,'Try delete',1),(21,1,'GDAHGA','BSCE',3980.00,'2026-05-29 12:16:49','66611231',1,'2026-05-29 15:49:13','Mofication',0),(22,1,'Try Buying','BSCE',2080.00,'2026-05-30 00:22:04','25125127113',1,'2026-05-30 04:42:27','No program',0),(23,8,'Ronalds J','BSCE',1310.00,'2026-05-30 20:20:50','71233212',NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('Admin','Staff') NOT NULL DEFAULT 'Staff',
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `force_password_change` tinyint(1) DEFAULT 0,
  `failed_login_attempts` int(11) DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `reset_otp` varchar(6) DEFAULT NULL,
  `otp_expiry` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'System Admin','admin@evsu.edu.ph','$2b$12$sLzOK.4v7djIiZHjwFcy3OGNh0Fm0SBjhACi6MVC1LjuWyTjXXrAi','Admin',0,'2026-05-25 01:26:23',0,0,NULL,NULL,NULL),(2,'Maria Santos','maria.santos@evsu.edu.ph','$2y$10$wNBnKgFLJShuNL/x8Jbrb.d2w2SrtHrBAhzC0VRMg7umc.EUcvJt6','Staff',0,'2026-05-27 10:00:00',0,2,NULL,NULL,NULL),(3,'Juan Dela Cruz','juan.delacruz@evsu.edu.ph','$2y$10$wNBnKgFLJShuNL/x8Jbrb.d2w2SrtHrBAhzC0VRMg7umc.EUcvJt6','Staff',1,'2026-05-27 10:00:00',0,5,'2026-05-28 12:37:02',NULL,NULL),(6,'Michael Sales ','michaelkent.sales@evsu.edu.ph','$2b$12$TRsTnaWPCSDj4nUTEQ.hYOL4SrePoO/zbtAIs/y0j9BmkgCnIC6ry','Staff',0,'2026-05-28 11:05:08',0,0,NULL,NULL,NULL),(7,'Edward','edwardanthony.marquez@evsu.edu.ph','$2b$12$5IqZEX7NNOf10sUBXBexF.3dnShQOKsg7gylMZFQzGShBF79WA6w2','Staff',0,'2026-05-30 12:09:53',1,0,NULL,NULL,NULL),(8,'Ronaldo Dasigan','ronaldo.dasigan@evsu.edu.ph','$2b$12$6jiAZ/Ui9.LVp/BetvWa/ejtmDFYy6ce48oCi4qF2U7R1GDelmA.u','Staff',0,'2026-05-30 12:15:48',0,0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-31 11:34:53
