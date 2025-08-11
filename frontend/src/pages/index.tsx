import React from 'react';
import Head from 'next/head';

/**
 * ホームページコンポーネント
 * AWSエンジニア向け多言語対応コミュニティサイトのメインページ
 */
export default function Home() {
  return (
    <>
      <Head>
        <title>AWS Engineers Community</title>
        <meta name="description" content="AWSエンジニア向け多言語対応コミュニティサイト" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              AWS Engineers Community
            </h1>
            <p className="text-xl text-gray-600">
              言語の壁を越えて、世界中のAWSエンジニアと繋がろう
            </p>
          </header>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">開発中...</h2>
            <p className="text-gray-600">
              現在、多言語対応コミュニティサイトを開発中です。
              <br />
              まもなく素晴らしい機能をお届けします！
            </p>
          </div>
        </div>
      </main>
    </>
  );
}