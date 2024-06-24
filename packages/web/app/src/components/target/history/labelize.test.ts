import { labelize } from './labelize';

describe('labelize', () => {
  it('should work', () => {
    expect(
      labelize(
        "Description for argument id on field 'User.email' changed from 'ID&apos;s of &quot;User&quot;' to 'ID&apos;s of &quot;Hello&quot;'",
      ),
    ).toMatchInlineSnapshot(`
      [
        Description for argument id on field ,
        <Label
          dangerouslySetInnerHTML={
            {
              __html: User.email,
            }
          }
        />,
         changed from ,
        <Label
          dangerouslySetInnerHTML={
            {
              __html: ID&apos;s of &quot;User&quot;,
            }
          }
        />,
         to ,
        <Label
          dangerouslySetInnerHTML={
            {
              __html: ID&apos;s of &quot;Hello&quot;,
            }
          }
        />,
        ,
      ]
    `);
  });
});
