import prismaClient from "../utils/prismaClient.js";

// 사용자가 포토카드를 이미 상점에 등록했는지 확인
const getCheckCardById = async (userId, cardId) => {
  return await prismaClient.shopCard.findUnique({
    where: {
      userId_cardId: { userId, cardId }, // 복합 고유 키 사용
    },
  });
};

// 상점 카드 생성
const createShopCard = async (data) => {
  return await prismaClient.shop.create({
    data: {
      ...data,
      exchangeGrade: data.exchangeGrade,
      exchangeGenre: data.exchangeGenre,
      exchangeDescription: data.exchangeDescription,
    },
  });
};

// 카드 잔여 개수 업데이트
const updateCardRemainingCount = async (cardId, decrement) => {
  return await prismaClient.card.update({
    where: { id: cardId },
    data: { remainingCount: { decrement } },
  });
};

const getShopItem = async (id) => {
  return prismaClient.shop.findFirst({
    where: {
      id,
    },
  });
};

// 상점 카드 상세 정보 조회
const getShopById = async (shopId) => {
  return await prismaClient.shop.findUnique({
    where: { id: shopId },
    include: {
      user: { select: { nickname: true } }, // 판매자의 닉네임 정보 포함
      card: {
        select: {
          name: true, // 카드 이름
          genre: true, // 카드 장르
          grade: true, // 카드 등급
          imageURL: true, // 카드 이미지 URL
        },
      },
    },
  });
};

// 상점 카드 정보 업데이트
const updateShopCard = async (data) => {
  return await prismaClient.shop.update({
    where: { id: data.shopId },
    data: {
      price: data.price,
      totalCount: data.totalCount,
      remainingCount: data.remainingCount,
      exchangeGrade: data.exchangeGrade,
      exchangeGenre: data.exchangeGenre,
      exchangeDescription: data.exchangeDescription,
    },
  });
};

// 상점 카드 삭제 및 관련 정보 업데이트
const deleteShopCard = async (shopId, userId) => {
  return await prismaClient.$transaction(async (prisma) => {
    const shopCard = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { card: true, user: true },
    });

    // 상점 카드가 없는 경우 에러 발생
    if (!shopCard) throw new Error(`Shop card with ID ${shopId} not found.`);

    // 삭제 요청을 보낸 사용자 ID와 카드의 소유자 ID 일치 여부 확인
    if (shopCard.userId !== userId) {
      throw new Error("Unauthorized access to this card");
    }

    // 카드 남은 수량 업데이트
    const updatedCard = await prisma.card.update({
      where: { id: shopCard.cardId },
      data: { remainingCount: { increment: shopCard.remainingCount } },
    });

    // 상점 카드 삭제
    const deletedShopCard = await prisma.shop.delete({
      where: { id: shopId },
    });

    return { deletedShopCard, updatedCard }; // 삭제된 카드 정보 반환
  });
};

// 모든 판매중인 카드 조회
const getAllShop = async () => {
  return await prismaClient.shop.findMany({
    include: {
      card: true, // 카드 정보도 포함
      user: { select: { nickname: true } }, // 판매자의 닉네임 정보 포함
    },
  });
};

export default {
  getCheckCardById,
  createShopCard,
  getShopById,
  getShopItem,
  updateShopCard,
  deleteShopCard,
  updateCardRemainingCount,
  getAllShop,
};
