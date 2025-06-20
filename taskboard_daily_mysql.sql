-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Versi server:                 8.0.30 - MySQL Community Server - GPL
-- OS Server:                    Win64
-- HeidiSQL Versi:               12.1.0.6537
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- membuang struktur untuk table taskboard_daily_mysql.daily_snapshots
CREATE TABLE IF NOT EXISTS `daily_snapshots` (
  `date` date NOT NULL,
  PRIMARY KEY (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Membuang data untuk tabel taskboard_daily_mysql.daily_snapshots: ~0 rows (lebih kurang)
INSERT INTO `daily_snapshots` (`date`) VALUES
	('2025-06-20');

-- membuang struktur untuk table taskboard_daily_mysql.tasks
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `priority` varchar(255) NOT NULL,
  `snapshotDate` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_snapshotDate` (`snapshotDate`),
  KEY `tasks_snapshot_date` (`snapshotDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Membuang data untuk tabel taskboard_daily_mysql.tasks: ~3 rows (lebih kurang)
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `priority`, `snapshotDate`) VALUES
	('0dxy56nm6', 'asasa', 'Backlog', 'UNIT 1', 'medium', '2025-06-20'),
	('o5wxrzwc1', 'Test', 'Backlog', 'UNIT 1', 'low', '2025-06-20'),
	('sujkpw6fx', 'TEST', 'Ongoing', 'UNIT 1', 'medium', '2025-06-20'),
	('xhi9ypavr', 'TEst', 'Done', 'IP 4', 'medium', '2025-06-20');

-- membuang struktur untuk table taskboard_daily_mysql.units
CREATE TABLE IF NOT EXISTS `units` (
  `name` varchar(255) NOT NULL,
  `orderIndex` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Membuang data untuk tabel taskboard_daily_mysql.units: ~14 rows (lebih kurang)
INSERT INTO `units` (`name`, `orderIndex`) VALUES
	('IP 2', 2),
	('IP 3', 3),
	('IP 4', 4),
	('IP KP', 1),
	('UNIT 1', 5),
	('UNIT 10', 5),
	('UNIT 2', 6),
	('UNIT 3', 7),
	('UNIT 4', 8),
	('UNIT 5', 9),
	('UNIT 6', 10),
	('UNIT 7', 11),
	('UNIT 8', 12),
	('UNIT 9', 13);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
