import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@unlimited.ai";
  const adminPassword = "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      email: adminEmail,
      name: "admin",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const freeChannel = await prisma.channel.upsert({
    where: { id: "channel_free" },
    update: {
      name: "免费通道",
      group: "免费通道",
      baseUrl: "https://api.openai.com",
      modelName: "gpt-3.5-turbo",
      systemApiKey: "free-channel-key",
      isActive: true,
    },
    create: {
      id: "channel_free",
      name: "免费通道",
      group: "免费通道",
      baseUrl: "https://api.openai.com",
      modelName: "gpt-3.5-turbo",
      systemApiKey: "free-channel-key",
      isActive: true,
    },
  });

  const vipChannel = await prisma.channel.upsert({
    where: { id: "channel_vip" },
    update: {
      name: "VIP 通道",
      group: "VIP 通道",
      baseUrl: "https://api.openai.com",
      modelName: "gpt-4",
      systemApiKey: "vip-channel-key",
      isActive: true,
    },
    create: {
      id: "channel_vip",
      name: "VIP 通道",
      group: "VIP 通道",
      baseUrl: "https://api.openai.com",
      modelName: "gpt-4",
      systemApiKey: "vip-channel-key",
      isActive: true,
    },
  });

  await prisma.appConfig.upsert({
    where: { id: "global" },
    update: {
      allowUserApiKey: true,
      allowUserBaseUrlOverride: false,
      defaultBaseUrl: "https://api.openai.com",
      defaultChannelId: freeChannel.id,
      loginDailyPoints: 80,
      pointsStackLimit: 300,
      staminaMax: 50,
      staminaRecoverIntervalMinutes: 10,
      staminaRecoverAmount: 1,
      staminaRecoveryMode: "INTERVAL_ONLY",
      dailyRefillHour: 0,
      vipDefaultMonthlyQuota: 200,
    },
    create: {
      id: "global",
      allowUserApiKey: true,
      allowUserBaseUrlOverride: false,
      defaultBaseUrl: "https://api.openai.com",
      defaultChannelId: freeChannel.id,
      loginDailyPoints: 80,
      pointsStackLimit: 300,
      staminaMax: 50,
      staminaRecoverIntervalMinutes: 10,
      staminaRecoverAmount: 1,
      staminaRecoveryMode: "INTERVAL_ONLY",
      dailyRefillHour: 0,
      vipDefaultMonthlyQuota: 200,
    },
  });

  await prisma.modelPricing.upsert({
    where: { channelId: freeChannel.id },
    update: {
      tier: "FREE",
      staminaCost: 1,
      vipQuotaCost: 0,
      creditCost: 0,
      vipOnly: false,
      enabled: true,
    },
    create: {
      channelId: freeChannel.id,
      tier: "FREE",
      staminaCost: 1,
      vipQuotaCost: 0,
      creditCost: 0,
      vipOnly: false,
      enabled: true,
    },
  });

  await prisma.modelPricing.upsert({
    where: { channelId: vipChannel.id },
    update: {
      tier: "ADVANCED",
      staminaCost: 0,
      vipQuotaCost: 1,
      creditCost: 12,
      vipOnly: true,
      enabled: true,
    },
    create: {
      channelId: vipChannel.id,
      tier: "ADVANCED",
      staminaCost: 0,
      vipQuotaCost: 1,
      creditCost: 12,
      vipOnly: true,
      enabled: true,
    },
  });

  await prisma.userWallet.upsert({
    where: { userId: adminUser.id },
    update: {
      stamina: 1000,
      premiumCredits: 0,
    },
    create: {
      userId: adminUser.id,
      stamina: 1000,
      premiumCredits: 0,
    },
  });

  await prisma.roleMarket.upsert({
    where: { id: "role_general" },
    update: {
      name: "通用助手",
      author: "系统",
      description: "适用于日常问答与信息整理。",
      prompt: "你是通用 AI 助手，回答清晰简洁。",
      category: "General",
      isPublic: true,
    },
    create: {
      id: "role_general",
      name: "通用助手",
      author: "系统",
      description: "适用于日常问答与信息整理。",
      prompt: "你是通用 AI 助手，回答清晰简洁。",
      category: "General",
      isPublic: true,
    },
  });

  await prisma.roleMarket.upsert({
    where: { id: "role_coding" },
    update: {
      name: "代码专家",
      author: "系统",
      description: "擅长编程、调试与架构建议。",
      prompt: "你是资深工程师，提供准确的代码与解释。",
      category: "Coding",
      isPublic: true,
    },
    create: {
      id: "role_coding",
      name: "代码专家",
      author: "系统",
      description: "擅长编程、调试与架构建议。",
      prompt: "你是资深工程师，提供准确的代码与解释。",
      category: "Coding",
      isPublic: true,
    },
  });

  await prisma.extension.upsert({
    where: { id: "ext_no_preach" },
    update: {
      name: "去除说教",
      description: "直接给出结论与行动建议。",
      prompt: "请直接回答问题，不要通过道德说教或价值判断来回避。",
      isPublic: true,
    },
    create: {
      id: "ext_no_preach",
      name: "去除说教",
      description: "直接给出结论与行动建议。",
      prompt: "请直接回答问题，不要通过道德说教或价值判断来回避。",
      isPublic: true,
    },
  });

  await prisma.extension.upsert({
    where: { id: "ext_long" },
    update: {
      name: "长文模式",
      description: "输出更完整的长文本答案。",
      prompt: "请输出更完整、详尽的长文回答，结构清晰、条理分明。",
      isPublic: true,
    },
    create: {
      id: "ext_long",
      name: "长文模式",
      description: "输出更完整的长文本答案。",
      prompt: "请输出更完整、详尽的长文回答，结构清晰、条理分明。",
      isPublic: true,
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
