import { FC, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import tw, { css, styled } from 'twin.macro';

import { Button, Heading, HiveLink, Input, ProjectTypes, ShineBackground } from '@/components/v2';
import MembersPage from './members';

const Container = tw.div`flex flex-col items-center flex-1 max-w-[690px] self-center pb-48`;
const Title = tw.h2`text-2xl font-light mb-1`;
const Card = tw.div`h-[340px] text-center bg-gray-800/30 rounded-[10px] p-5 mt-11`;

const InputWithBorder = styled(Input)(() => [
  tw`
    w-full
    bg-transparent
    text-[42px]
    border-b-2 border-b-gray-800
    py-9
    rounded-none
  `,
  css({
    input: tw`placeholder-gray-800 text-center`,
  }),
]);

const NewPage: FC = () => {
  const [page, setPage] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    wrapperRef.current.scrollIntoView({
      behavior: 'smooth',
    });
  }, [page]);

  const handleNext = () => {
    setPage(prevPage => prevPage + 1);
  };

  const handlePrev = () => {
    setPage(prevPage => prevPage - 1);
  };

  const getContent = () => {
    switch (page) {
      case 0:
        return (
          <Container tw="pb-10">
            <Card tw="w-[450px] mb-7" />
            <Title>Welcome</Title>
            <p className="mb-10 text-center font-light text-gray-500">
              Create organization Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et dictum mattis
              tincidunt quis iaculis arcu proin suspendisse.
            </p>
            <Button variant="primary" size="large" block tw="w-[450px]" onClick={handleNext}>
              Create Organization
            </Button>
          </Container>
        );

      case 1:
        return (
          <Container tw="justify-center pb-0">
            <Title>Welcome</Title>
            <p className="mb-10 text-center font-light text-gray-500">
              Create organization Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et dictum mattis
              tincidunt quis iaculis arcu proin suspendisse.
            </p>
            <InputWithBorder placeholder="Organization Name" />
          </Container>
        );
      case 2:
        return (
          <Container tw="mt-8">
            <Title>Create Project</Title>
            <p className="mb-10 text-center font-light text-gray-500">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et dictum mattis tincidunt quis iaculis
              arcu proin suspendisse.
            </p>
            <InputWithBorder placeholder="Project Name" />
            <span className="mt-5 mb-2.5 text-xs font-bold">CHOOSE PROJECT TYPE</span>
            <ProjectTypes className="w-[450px]" />
          </Container>
        );
      case 3:
        return (
          <Container tw="mt-16">
            <Title>Add Members</Title>
            <p className="mb-10 text-center font-light text-gray-500">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et dictum mattis tincidunt quis iaculis
              arcu proin suspendisse.
            </p>
            <MembersPage />
          </Container>
        );
      case 4:
        return (
          <Container tw="mt-16">
            <Title>Create Your First Target</Title>
            <p className="mb-10 text-center font-light text-gray-500">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et dictum mattis tincidunt quis iaculis
              arcu proin suspendisse.
            </p>
            <InputWithBorder placeholder="Target Name" />
            <Card>
              <Heading size="lg">Connect Your Scheme</Heading>
              <p className="text-sm text-gray-500">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et dictum mattis tincidunt quis iaculis
                arcu proin suspendisse.
              </p>
            </Card>
          </Container>
        );
      case 5:
        return (
          <Container tw="mt-16 pb-10">
            <Card tw="w-[450px] mb-7" />
            <Title>We are building your project</Title>
            <p className="mb-10 text-center font-light text-gray-500">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et dictum mattis tincidunt quis iaculis
              arcu proin suspendisse.
            </p>
          </Container>
        );
    }
  };

  return (
    <>
      <ShineBackground />
      <div className="wrapper relative flex h-full flex-col pt-5 pb-[155px]" ref={wrapperRef}>
        {[3, 4, 5].includes(page) && (
          <div className="absolute top-0 right-1/2 translate-x-1/2 rounded-b-[10px] border border-t-0 border-gray-800 px-2.5 py-7">
            <h1 className="text-center text-xs font-bold text-[#34eab9]">THE GUILD</h1>
            <h2 className="text-center text-lg font-bold">GraphQL Hive Test</h2>
          </div>
        )}
        <HiveLink className="self-start" />
        {getContent()}
      </div>
      {[1, 2, 3, 4].includes(page) && (
        <div className="fixed inset-x-0 bottom-0" style={{ boxShadow: '0 -1px 0 #171a1f' }}>
          <div className="mx-auto w-[700px] bg-black/60 py-8 backdrop-blur">
            <div className="mx-auto flex w-[450px] justify-center gap-x-5">
              {page !== 1 && (
                <Button variant="secondary" block size="large" onClick={handlePrev}>
                  Back
                </Button>
              )}
              <Button variant="primary" size="large" block onClick={handleNext}>
                {page === 4 ? 'Later' : 'Next'}
              </Button>
            </div>
            <div className="mt-6 flex justify-center gap-x-1">
              {[1, 2, 3, 4].map(pageNum => (
                <div
                  key={pageNum}
                  className={clsx(
                    'h-1 w-[13px] rounded-[100px] bg-gray-500 transition-colors',
                    page >= pageNum && 'bg-orange-500'
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewPage;
