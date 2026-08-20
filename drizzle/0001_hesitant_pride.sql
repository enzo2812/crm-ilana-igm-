CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`messageId` int,
	`classification` enum('CURSO','CLÍNICA ADMINISTRATIVA','CLÍNICA CLÍNICA','FINANCEIRO','RISCO') NOT NULL,
	`action` enum('RESPOSTA','HANDOFF','BLOQUEIO') NOT NULL,
	`ruleTriggered` varchar(220) NOT NULL,
	`knowledgeOrigin` varchar(220),
	`knowledgeVersion` int,
	`responseExcerpt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`funnel` enum('CURSOS','CLÍNICA') NOT NULL DEFAULT 'CURSOS',
	`funnelStage` varchar(80) NOT NULL DEFAULT 'Novo contato',
	`tags` text,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`category` enum('CURSO','CLÍNICA ADMINISTRATIVA','CLÍNICA CLÍNICA','FINANCEIRO','RISCO') NOT NULL DEFAULT 'CURSO',
	`status` enum('ATIVA','HANDOFF') NOT NULL DEFAULT 'ATIVA',
	`handoffReason` text,
	`autoReplyBlocked` boolean NOT NULL DEFAULT false,
	`firstMessageSent` boolean NOT NULL DEFAULT false,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `followUpTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int,
	`title` varchar(220) NOT NULL,
	`status` enum('PENDENTE','EM ANDAMENTO','CONCLUÍDA') NOT NULL DEFAULT 'PENDENTE',
	`owner` varchar(160) NOT NULL DEFAULT 'Equipe IGM',
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `followUpTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeArticles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` enum('CURSOS','CLÍNICA','GERAL') NOT NULL DEFAULT 'GERAL',
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`sourceLabel` varchar(180) NOT NULL DEFAULT 'Base aprovada pela equipe',
	`version` int NOT NULL DEFAULT 1,
	`isApproved` boolean NOT NULL DEFAULT true,
	`updatedBy` varchar(160) NOT NULL DEFAULT 'Equipe IGM',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledgeArticles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`direction` enum('ENTRADA','SAÍDA') NOT NULL,
	`senderType` enum('CONTATO','ASSISTENTE','EQUIPE') NOT NULL,
	`content` text NOT NULL,
	`isAutomated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `followUpTasks` ADD CONSTRAINT `followUpTasks_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;