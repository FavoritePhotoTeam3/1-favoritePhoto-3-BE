import prismaClient from "../utils/prismaClient.js";

// 상점 카드 정보 체크
const getCheckCardById = async (userId, cardId) => {
  return await prismaClient.shopCard.findUnique({
    where: {
      userId_cardId: { userId, cardId }, // 복합 고유 키 사용
    },
  });
};

// 상점 카드 생성
const createShopCard = async (data) => {
  return await prismaClient.shopCard.create({
    data: {
      ...data,
      exchangeGrade: data.exchangeGrade, // 교환 희망 등급
      exchangeGenre: data.exchangeGenre, // 교환 희망 장르
      exchangeDescription: data.exchangeDescription, // 교환 희망 설명
    },
  });
};

// 상점에 등록된 카드 목록 조회
const getShopCards = async (filters) => {
  console.log("Filters:", filters); // filters 확인

  const { page, pageSize, orderBy, keyword, grade, genre, isSoldOut } = filters;

  const where = {
    card: {
      OR: [
        { name: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
      ],
      ...(grade && { grade }),
      ...(genre && { genre }),
    },
    ...(typeof isSoldOut === "boolean" && {
      remainingCount: isSoldOut ? 0 : { gt: 0 },
    }),
  };

  console.log("Where clause:", where); // where 조건 확인

  const order = {
    ...(orderBy === "recent" && { createAt: "desc" }),
    ...(orderBy === "old" && { createAt: "asc" }),
    ...(orderBy === "lowPrice" && { price: "asc" }),
    ...(orderBy === "highPrice" && { price: "desc" }),
  };

  console.log("Order clause:", order); // order 조건 확인

  const cards = await prismaClient.shopCard.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: order,
    include: { card: true },
  });

  const cardsWithSoldOutFlag = cards.map((card) => ({
    ...card,
    isSoldOut: card.remainingCount === 0,
  }));

  return cardsWithSoldOutFlag;
};

// 상점에 등록된 카드 총 개수 조회
const getShopCardCount = async (data) => {
  const { keyword, grade, genre } = data;

  const where = {
    card: {
      OR: [
        { name: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
      ],
      ...(grade && { grade }),
      ...(genre && { genre }),
    },
  };

  return await prismaClient.shopCard.count({ where });
};

// 상점 카드 상세 정보 조회
const getShopCardById = async (cardId) => {
  return await prismaClient.shopCard.findUnique({
    where: { id: cardId },
    include: {
      card: {
        select: {
          name: true,
          description: true,
          price: true,
          totalCount: true,
          remainingCount: true,
          imageURL: true, // 이미지 URL 추가
          genre: true, // 장르 추가
          grade: true, // 등급 추가
        },
      },
      user: { select: { nickname: true } }, // 판매자 정보에서 닉네임만 포함
      exchange: {
        select: {
          id: true, // 교환 ID
          exchangeDescription: true, // 교환 설명
          exchangeGrade: true, // 희망하는 카드 등급
          exchangeGenre: true, // 희망하는 카드 장르
        },
      },
    },
  });
};

// 판매자 정보 가져오기
const getUserById = async (userId) => {
  return await prismaClient.user.findUnique({
    where: { id: userId },
    select: { nickname: true }, // 닉네임만 선택적으로 가져오기
  });
};

// 상점 카드 정보 업데이트
const updateShopCard = async (data) => {
  return await prismaClient.shopCard.update({
    where: { id: data.shopId },
    data: {
      price: data.price,
      totalCount: data.totalCount,
      exchangeGrade: data.exchangeGrade,
      exchangeGenre: data.exchangeGenre,
      exchangeDescription: data.exchangeDescription,
    },
  });
};

// 상점 카드 삭제 및 관련 정보 업데이트 (트랜잭션 사용)
const deleteShopCard = async (shopId) => {
  return await prismaClient.$transaction(async (prisma) => {
    const shopCard = await prisma.shopCard.findUnique({
      where: { id: shopId },
      include: { card: true, user: true },
    });

    if (!shopCard) throw new Error(`Shop card with ID ${shopId} not found.`);

    const updatedCard = await prisma.card.update({
      where: { id: shopCard.cardId },
      data: { remainingCount: { increment: shopCard.remainingCount } },
    });

    const deletedShopCard = await prisma.shopCard.delete({
      where: { id: shopId },
    });

    await prisma.notification.create({
      data: {
        content: `${shopCard.user.nickname}님이 [${shopCard.card.grade} | ${shopCard.card.name}]을 판매취소 했습니다.`,
        userId: shopCard.userId,
      },
    });

    return { deletedShopCard, updatedCard };
  });
};

// 카드 구매 처리 (트랜잭션 사용)
// 알림 로직 수정해야함
const purchaseShopCard = async (data) => {
  const { shopId, count, buyerId } = data;

  return await prismaClient.$transaction(async (prisma) => {
    const shopCard = await prisma.shopCard.findUnique({
      where: { id: shopId },
      include: { card: true, user: true },
    });

    if (!shopCard) throw new Error("Shop card not found.");
    if (shopCard.remainingCount < count)
      throw new Error("Not enough cards available for purchase.");

    const totalPurchasePrice = shopCard.price * count;
    const buyer = await prisma.user.findUnique({ where: { id: buyerId } });

    if (buyer.point < totalPurchasePrice)
      throw new Error("Insufficient points for purchase.");

    const sellerId = shopCard.user.id;

    await prisma.user.update({
      where: { id: buyerId },
      data: { point: { decrement: totalPurchasePrice } },
    });

    await prisma.user.update({
      where: { id: sellerId },
      data: { point: { increment: totalPurchasePrice } },
    });

    await prisma.shopCard.update({
      where: { id: shopId },
      data: { remainingCount: { decrement: count } },
    });

    if (shopCard.remainingCount == count) {
      await prismaClient.notification.create({
        content: ` ${shopCard.user.nickname}님의 [${shopCard.card.grade} | ${shopCard.card.name}] 포토카드가 품절되었습니다.`,
        type: "품절",
        userId: sellerId,
      });
    }

    const purchasedCard = await prisma.card.create({
      data: {
        userId: buyerId,
        totalCount: count,
        name: shopCard.card.name,
        description: shopCard.card.description,
        remainingCount: count,
        imageURL: shopCard.card.imageURL,
        grade: shopCard.card.grade,
        genre: shopCard.card.genre,
        purchasePrice: shopCard.card.price,
      },
    });

    await prisma.purchase.create({
      data: { cardId: purchasedCard.id, userId: buyerId },
    });

    return { message: "Card purchased successfully." };
  });
};

export {
  getCheckCardById,
  createShopCard,
  getShopCards,
  getShopCardCount,
  getShopCardById,
  getUserById,
  updateShopCard,
  deleteShopCard,
  purchaseShopCard,
};
